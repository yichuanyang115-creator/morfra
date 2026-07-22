import { beforeEach, describe, expect, it, vi } from "vitest";

const openMock = vi.fn();
const openPathMock = vi.fn();
const openUrlMock = vi.fn();

vi.mock("@tauri-apps/plugin-dialog", () => ({
  open: openMock,
}));

vi.mock("@tauri-apps/plugin-opener", () => ({
  openPath: openPathMock,
  openUrl: openUrlMock,
}));

const { pickAttachmentFile, linkAttachmentFromUrl, openAttachment } = await import("./attachments");

describe("attachments", () => {
  beforeEach(() => {
    openMock.mockReset();
    openPathMock.mockReset();
    openUrlMock.mockReset();
  });

  it("pickAttachmentFile 用户选中文件后返回 file 类型附件，label 取路径最后一段作为文件名", async () => {
    openMock.mockResolvedValueOnce("/Users/test/Documents/设计稿.fig");

    const attach = await pickAttachmentFile();

    expect(attach).toEqual({ type: "file", url: "/Users/test/Documents/设计稿.fig", label: "设计稿.fig" });
  });

  it("pickAttachmentFile 用户在系统对话框里点击取消，返回 null 而不是抛错或返回半个附件对象", async () => {
    openMock.mockResolvedValueOnce(null);

    const attach = await pickAttachmentFile();

    expect(attach).toBeNull();
  });

  it("linkAttachmentFromUrl 把用户输入的链接文本包装成 link 类型附件，label 默认就是 url 本身", () => {
    const attach = linkAttachmentFromUrl("https://example.com/spec.pdf");
    expect(attach).toEqual({ type: "link", url: "https://example.com/spec.pdf", label: "https://example.com/spec.pdf" });
  });

  it("openAttachment 对 file 类型调用 openPath（系统默认应用打开），不调用 openUrl", async () => {
    await openAttachment({ type: "file", url: "/tmp/a.png", label: "a.png" });
    expect(openPathMock).toHaveBeenCalledWith("/tmp/a.png");
    expect(openUrlMock).not.toHaveBeenCalled();
  });

  it("openAttachment 对 link 类型调用 openUrl（浏览器打开），不调用 openPath", async () => {
    await openAttachment({ type: "link", url: "https://example.com", label: "https://example.com" });
    expect(openUrlMock).toHaveBeenCalledWith("https://example.com");
    expect(openPathMock).not.toHaveBeenCalled();
  });
});
