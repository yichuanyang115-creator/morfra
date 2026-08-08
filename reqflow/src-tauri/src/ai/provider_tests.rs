use std::io::{Read, Write};
use std::net::{Shutdown, TcpListener};
use std::sync::mpsc::{self, Receiver};
use std::thread::{self, JoinHandle};

use super::provider::{normalize_base_url, CapabilitySupport, ChatMessage, ProviderClient};
use crate::ai::errors::AIErrorCode;

struct FakeResponse {
    status: u16,
    content_type: &'static str,
    body: &'static [u8],
    close: bool,
}

struct FakeServer {
    base_url: String,
    requests: Receiver<Vec<u8>>,
    thread: JoinHandle<()>,
}

fn fake_server(responses: Vec<FakeResponse>) -> FakeServer {
    let listener = TcpListener::bind("127.0.0.1:0").expect("fake server bind");
    let address = listener.local_addr().expect("fake server address");
    let (sender, requests) = mpsc::channel();
    let thread = thread::spawn(move || {
        for response in responses {
            let Ok((mut stream, _)) = listener.accept() else {
                return;
            };
            let mut request = Vec::new();
            let mut chunk = [0_u8; 1024];
            while !request.windows(4).any(|window| window == b"\r\n\r\n") {
                let Ok(read) = stream.read(&mut chunk) else {
                    return;
                };
                if read == 0 {
                    return;
                }
                request.extend_from_slice(&chunk[..read]);
                if request.len() > 64 * 1024 {
                    return;
                }
            }
            let header_end = request
                .windows(4)
                .position(|window| window == b"\r\n\r\n")
                .map(|position| position + 4)
                .unwrap_or(request.len());
            let header_text = String::from_utf8_lossy(&request[..header_end]);
            let body_length = header_text
                .lines()
                .find_map(|line| {
                    line.strip_prefix("Content-Length:")
                        .or_else(|| line.strip_prefix("content-length:"))
                })
                .and_then(|value| value.trim().parse::<usize>().ok())
                .unwrap_or(0);
            while request.len() < header_end + body_length {
                let Ok(read) = stream.read(&mut chunk) else {
                    return;
                };
                if read == 0 {
                    return;
                }
                request.extend_from_slice(&chunk[..read]);
            }
            let _ = sender.send(request);
            if response.close {
                let _ = stream.shutdown(Shutdown::Both);
                continue;
            }
            let status_text = match response.status {
                200 => "OK",
                400 => "Bad Request",
                401 => "Unauthorized",
                404 => "Not Found",
                429 => "Too Many Requests",
                _ => "Error",
            };
            let header = format!(
                    "HTTP/1.1 {} {}\r\nContent-Type: {}\r\nContent-Length: {}\r\nConnection: close\r\n\r\n",
                    response.status, status_text, response.content_type, response.body.len()
                );
            let _ = stream.write_all(header.as_bytes());
            let _ = stream.write_all(response.body);
        }
    });
    FakeServer {
        base_url: format!("http://{address}/v1"),
        requests,
        thread,
    }
}

fn client(base_url: &str) -> ProviderClient {
    ProviderClient::new_for_test(base_url, "unit-test-token".to_string()).expect("client")
}

#[test]
fn normalizes_base_url_without_duplicate_v1_and_lists_models_with_bearer_auth() {
    let server = fake_server(vec![FakeResponse {
        status: 200,
        content_type: "application/json",
        body: br#"{"data":[{"id":"gpt-test"},{"id":"gpt-test"}]}"#,
        close: false,
    }]);
    let result =
        tauri::async_runtime::block_on(client(&format!("{}/", server.base_url)).list_models())
            .expect("models");
    assert_eq!(result.model_ids, vec!["gpt-test"]);
    let request = server.requests.recv().expect("request");
    let request_text = String::from_utf8_lossy(&request);
    assert!(request_text.starts_with("GET /v1/models HTTP/1.1"));
    assert!(
        request_text.contains("authorization: Bearer unit-test-token")
            || request_text.contains("Authorization: Bearer unit-test-token")
    );
    server.thread.join().expect("server thread");
}

#[test]
fn models_404_is_recoverable_and_allows_manual_model_path() {
    let server = fake_server(vec![FakeResponse {
        status: 404,
        content_type: "application/json",
        body: br#"{"error":{"message":"models disabled"}}"#,
        close: false,
    }]);
    let error =
        tauri::async_runtime::block_on(client(&server.base_url).list_models()).expect_err("404");
    assert_eq!(error.code, AIErrorCode::ModelsUnavailable);
    assert!(error.message.contains("手填模型"));
    server.thread.join().expect("server thread");
}

#[test]
fn models_invalid_json_and_network_failure_are_structured() {
    let invalid = fake_server(vec![FakeResponse {
        status: 200,
        content_type: "application/json",
        body: br#"{"unexpected":true}"#,
        close: false,
    }]);
    let error = tauri::async_runtime::block_on(client(&invalid.base_url).list_models())
        .expect_err("invalid response");
    assert_eq!(error.code, AIErrorCode::InvalidResponse);
    invalid.thread.join().expect("server thread");

    let error = tauri::async_runtime::block_on(client("http://127.0.0.1:9/v1").list_models())
        .expect_err("network failure");
    assert_eq!(error.code, AIErrorCode::NetworkUnavailable);
}

#[test]
fn unauthorized_rate_limit_provider_error_and_model_not_found_are_not_leaked() {
    for (status, expected) in [
        (401, AIErrorCode::Unauthorized),
        (429, AIErrorCode::RateLimited),
    ] {
        let server = fake_server(vec![FakeResponse {
            status,
            content_type: "application/json",
            body: br#"{"error":{"message":"secret provider body"}}"#,
            close: false,
        }]);
        let error = tauri::async_runtime::block_on(client(&server.base_url).list_models())
            .expect_err("provider error");
        assert_eq!(error.code, expected);
        assert!(!error.message.contains("secret provider body"));
        server.thread.join().expect("server thread");
    }
    let server = fake_server(vec![FakeResponse {
        status: 404,
        content_type: "application/json",
        body: br#"{"error":{"message":"hidden model"}}"#,
        close: false,
    }]);
    let messages = vec![ChatMessage {
        role: "user".to_string(),
        content: "ping".to_string(),
    }];
    let error = tauri::async_runtime::block_on(client(&server.base_url).send_chat_request(
        "missing-model",
        &messages,
        false,
    ))
    .expect_err("missing model");
    assert_eq!(error.code, AIErrorCode::ModelNotFound);
    assert!(!error.message.contains("hidden model"));
    server.thread.join().expect("server thread");
}

#[test]
fn invalid_key_and_base_url_are_rejected_before_network() {
    assert_eq!(
        ProviderClient::new("https://api.example.test/v1", String::new())
            .err()
            .expect("key")
            .code,
        AIErrorCode::MissingApiKey
    );
    assert_eq!(
        normalize_base_url("http://api.example.test/v1", false)
            .expect_err("http")
            .code,
        AIErrorCode::InvalidBaseUrl
    );
    assert!(normalize_base_url("http://127.0.0.1:1234/v1", true).is_ok());
}

#[test]
fn probe_falls_back_to_one_shot_and_records_stream_support_without_guessing_other_capabilities() {
    let server = fake_server(vec![
        FakeResponse {
            status: 400,
            content_type: "application/json",
            body: br#"{"error":{"message":"stream unsupported"}}"#,
            close: false,
        },
        FakeResponse {
            status: 200,
            content_type: "application/json",
            body: br#"{"choices":[{"message":{"content":"pong"}}]}"#,
            close: false,
        },
    ]);
    let probe = tauri::async_runtime::block_on(client(&server.base_url).probe("manual-model"))
        .expect("probe");
    assert_eq!(probe.streaming, CapabilitySupport::Unsupported);
    assert_eq!(probe.structured_output, CapabilitySupport::Unknown);
    assert_eq!(probe.tool_calls, CapabilitySupport::Unknown);
    assert!(server.requests.recv().is_ok());
    assert!(server.requests.recv().is_ok());
    server.thread.join().expect("server thread");
}

#[test]
fn probe_detects_sse_and_rejects_disconnect() {
    let server = fake_server(vec![FakeResponse {
        status: 200,
        content_type: "text/event-stream",
        body: b"data: {\"choices\":[]}\n\ndata: [DONE]\n\n",
        close: false,
    }]);
    let probe = tauri::async_runtime::block_on(client(&server.base_url).probe("stream-model"))
        .expect("probe");
    assert_eq!(probe.streaming, CapabilitySupport::Supported);
    server.thread.join().expect("server thread");

    let server = fake_server(vec![FakeResponse {
        status: 200,
        content_type: "text/event-stream",
        body: b"data: {\"choices\":[",
        close: true,
    }]);
    let error = tauri::async_runtime::block_on(client(&server.base_url).probe("stream-model"))
        .expect_err("disconnect");
    assert_eq!(error.code, AIErrorCode::NetworkUnavailable);
    server.thread.join().expect("server thread");

    let server = fake_server(vec![FakeResponse {
        status: 200,
        content_type: "text/event-stream",
        body: b"data: not-json\n\ndata: [DONE]\n\n",
        close: false,
    }]);
    let error = tauri::async_runtime::block_on(client(&server.base_url).probe("stream-model"))
        .expect_err("invalid SSE JSON");
    assert_eq!(error.code, AIErrorCode::InvalidResponse);
    server.thread.join().expect("server thread");
}
