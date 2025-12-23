import {
  attr,
  FASTElement,
  html,
  observable,
  ref,
} from "@microsoft/fast-element";

class GpuCanvas extends FASTElement {
  @attr
  gpu_render?: (canvas: HTMLCanvasElement) => Promise<void>;

  canvas?: HTMLCanvasElement;

  connectedCallback() {
    super.connectedCallback();

    if (this.canvas !== undefined && this.gpu_render !== undefined) {
      this.gpu_render(this.canvas);
    } else {
      console.log("canvas: ", this.canvas, "\nrender: ", this.gpu_render);
    }
  }
}

GpuCanvas.define({
  name: "gpu-canvas",
  template: html<GpuCanvas>`<canvas ${ref("canvas")}></canvas>`,
});
