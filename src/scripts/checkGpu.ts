export async function start() {
  let gpu = navigator.gpu
  
  if (!gpu) {
    console.log('this browser does not support WebGPU')
    return
  }

  const adapter = await gpu.requestAdapter()
  if (!adapter) {
    console.log('this browser supports webgpu but it appears disabled')
    return
  }

  const device = await adapter.requestDevice()
  device.lost.then(info => {
    console.error(`WebGPU device was lost: ${info.message}`)

    if (info.reason !== 'destroyed') {
      start()
    }
  })
}
