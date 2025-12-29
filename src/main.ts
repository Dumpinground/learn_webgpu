import { FASTElement, html } from "@microsoft/fast-element";
// import "./style.css";
import "./components/triangle/triangle";
import "./components/gpucanvas/gpucanvas";
import { main as triangle } from "./scripts/triangle/triangle";
import { main as compute } from "./scripts/compute/compute";

class MainPage extends FASTElement {}

MainPage.define({
  name: "main-page",
  template: html<MainPage>`<gpu-canvas
    :render=${(_) => triangle}
  ></gpu-canvas>`,
});

await compute();
