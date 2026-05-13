import { FASTElement, html } from '@microsoft/fast-element'
// import "./style.css";
import './components/triangle/triangle'
import './components/gpucanvas/gpucanvas'
import { main as triangle } from './scripts/triangle/triangle'
import { main as uniform_triangle } from './scripts/triangle/uniform_triangle'
import { main as storage_buffer } from './scripts/triangle/storage_buffer'
import { main as texture } from './scripts/texture/texure'
import { main as compute } from './scripts/compute/compute'
import { start } from './scripts/checkGpu'

class MainPage extends FASTElement {}

MainPage.define({
  name: 'main-page',
  template: html<MainPage>`
    <gpu-canvas :render=${_ => triangle}></gpu-canvas>
    <gpu-canvas :render=${_ => uniform_triangle}></gpu-canvas>
    <gpu-canvas :render=${_ => storage_buffer}></gpu-canvas>
    <gpu-canvas :render=${_ => texture}></gpu-canvas>
  `,
})

if (await start()) {
  await compute()
}
