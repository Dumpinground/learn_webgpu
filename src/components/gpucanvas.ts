import { attr, FASTElement, html, ref } from "@microsoft/fast-element";

class GpuCanvas extends FASTElement {
  @attr
  gpu_render?: (canvas: HTMLCanvasElement) => Promise<void>;

  canvas?: HTMLCanvasElement;

  connectedCallback() {
    if (this.canvas !== undefined && this.gpu_render !== undefined) {
      this.gpu_render(this.canvas);
    }
  }
}

GpuCanvas.define({
  name: "gpu-canvas",
  template: html<GpuCanvas>`<canvas ${ref("canvas")}></canvas>`,
});
