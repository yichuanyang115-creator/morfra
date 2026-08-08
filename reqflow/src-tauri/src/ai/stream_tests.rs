use super::provider_protocol::parse_stream_delta;
use super::stream::{ActiveRequestRegistry, SseParser};
use crate::ai::errors::AIErrorCode;

#[test]
fn parses_multibyte_utf8_split_across_chunks_and_cross_line_data() {
    let mut parser = SseParser::default();
    let payload = "data: {\"text\":\ndata: \"你好\"}\n\ndata: [DONE]\n\n";
    let bytes = payload.as_bytes();
    let split = bytes
        .iter()
        .position(|byte| *byte == 0xe4)
        .expect("utf8 start")
        + 1;
    assert!(parser
        .push(&bytes[..split])
        .expect("first chunk")
        .is_empty());
    let events = parser.push(&bytes[split..]).expect("second chunk");
    assert_eq!(events[0].data, "{\"text\":\n\"你好\"}");
    assert_eq!(events[1].data, "[DONE]");
}

#[test]
fn parser_rejects_invalid_utf8_and_finish_handles_partial_line() {
    let mut parser = SseParser::default();
    assert!(parser.push(b"data: \xff\n").is_err());
    let mut parser = SseParser::default();
    parser.push(b"data: [DONE]").expect("partial line");
    assert_eq!(parser.finish().expect("finish")[0].data, "[DONE]");
    assert_eq!(
        parse_stream_delta("not-json")
            .expect_err("invalid JSON")
            .code,
        AIErrorCode::InvalidResponse
    );
}

#[test]
fn cancellation_is_idempotent_and_prevents_late_activity() {
    let registry = ActiveRequestRegistry::default();
    registry.begin("request-1").expect("begin");
    assert!(registry.begin("request-1").is_err());
    assert!(!registry.cancel("unknown"));
    assert!(registry.cancel("request-1"));
    assert!(!registry.is_active("request-1"));
    assert!(registry.cancel("request-1"));
    registry.finish("request-1");
    assert!(registry.begin("request-1").is_ok());
}
