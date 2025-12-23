import { FASTElement, html, ref } from "@microsoft/fast-element";
import wgsl from "./triangle.wgsl?raw";

async function main(canvas: HTMLCanvasElement) {
  const adapter = await navigator.gpu?.requestAdapter();
  const device = await adapter?.requestDevice();
  if (!device) {
    console.log("need a browser that supports WebGPU");
    return;
  }

  const context = canvas.getContext("webgpu");
  const presentationFormat = navigator.gpu.getPreferredCanvasFormat();
  context?.configure({
    device,
    format: presentationFormat,
  });

  const module = device.createShaderModule({
    label: "our hardcoded red triangle shaders",
    code: wgsl,
  });

  const pipeline = device.createRenderPipeline({
    label: "our hardcoded red triangle pipeline",
    layout: "auto",
    vertex: { module, entryPoint: "vs" },
    fragment: {
      module,
      entryPoint: "fs",
      targets: [{ format: presentationFormat }],
    },
  });

  const renderPassDescriptor: GPURenderPassDescriptor = {
    label: "our basic canvas renderPass",
    // colorAttachments: [],
    colorAttachments: [
      {
        view: context!.getCurrentTexture().createView(),
        clearValue: [0.3, 0.3, 0.3, 1],
        loadOp: "clear",
        storeOp: "store",
      },
    ],
  };

  const encoder = device?.createCommandEncoder({ label: "our encoder" });

  const pass = encoder?.beginRenderPass(renderPassDescriptor);
  pass.setPipeline(pipeline);
  pass.draw(3);
  pass.end();

  const commandBuffer = encoder.finish();
  device.queue.submit([commandBuffer]);
}

class TriangleCanvas extends FASTElement {
  canvas?: HTMLCanvasElement;

  connectedCallback() {
    super.connectedCallback();

    if (this.canvas !== undefined) {
      main(this.canvas);
    }
  }
}

TriangleCanvas.define({
  name: "triangle-canvas",
  template: html<TriangleCanvas>`<canvas ${ref("canvas")}></canvas>`,
});
