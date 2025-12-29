import { attr, FASTElement, html, ref } from "@microsoft/fast-element";
import styles from "./gpucanvas.css?raw";

class GpuCanvas extends FASTElement {
  @attr
  render?: (canvas: HTMLCanvasElement) => Promise<void>;

  canvas?: HTMLCanvasElement;

  connectedCallback() {
    super.connectedCallback();

    if (this.canvas !== undefined && this.render !== undefined) {
      this.render(this.canvas);
    } else {
      console.log(
        "render init for canvas failed:\n",
        "canvas: ",
        this.canvas,
        "\nrender: ",
        this.render,
      );
    }
  }
}

GpuCanvas.define({
  name: "gpu-canvas",
  template: html<GpuCanvas>`<canvas ${ref("canvas")}></canvas>`,
  styles,
});
