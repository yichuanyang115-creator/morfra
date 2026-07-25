import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

// jsdom 没实现 Range/Element 的布局测算方法，ProseMirror（Tiptap 底层）在
// focus/滚动到光标时会调用它们计算坐标——测试环境不需要真实布局，补空实现即可
if (typeof document !== "undefined") {
  const emptyRect = (): DOMRect => ({
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    toJSON() {
      return this;
    },
  });

  Range.prototype.getClientRects = () => [] as unknown as DOMRectList;
  Range.prototype.getBoundingClientRect = emptyRect;
  Element.prototype.getClientRects = () => [] as unknown as DOMRectList;
  Element.prototype.getBoundingClientRect = emptyRect;

  // jsdom 没实现 pointer capture——分隔条拖拽用 setPointerCapture 让拖动过程中
  // 鼠标移出元素边界也能继续收到 pointermove，测试环境补空实现即可
  if (!Element.prototype.setPointerCapture) {
    Element.prototype.setPointerCapture = () => undefined;
  }
  if (!Element.prototype.releasePointerCapture) {
    Element.prototype.releasePointerCapture = () => undefined;
  }

  // jsdom 没实现 scrollTo——对话框收到新消息后滚动到底部会调用它，测试环境补空实现即可
  if (!Element.prototype.scrollTo) {
    Element.prototype.scrollTo = () => undefined;
  }
}

afterEach(() => {
  cleanup();
});
