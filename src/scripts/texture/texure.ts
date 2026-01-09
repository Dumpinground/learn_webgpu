import GUI from 'muigui'
import wgsl from './texture.wgsl?raw'

export async function main(canvas: HTMLCanvasElement) {
  const adapter = await navigator.gpu?.requestAdapter()
  const device = await adapter?.requestDevice()
  if (!device) {
    fail('need a browser that supports WebGPU')
    return
  }

  const context = canvas.getContext('webgpu')

  if (!context) return

  const presentationFormat = navigator.gpu.getPreferredCanvasFormat()
  context.configure({
    device,
    format: presentationFormat,
  })

  const module = device.createShaderModule({
    label: 'our hardcoded rgb triangle shaders',
    code: wgsl,
  })

  const pipeline = device.createRenderPipeline({
    label: 'our hardcoded rgb triangle pipeline',
    layout: 'auto',
    vertex: {
      module,
    },
    fragment: {
      module,
      targets: [{ format: presentationFormat }],
    },
  })

  const kTextureWidth = 5
  const kTexureHeight = 7
  const _ = [255, 0, 0, 255]
  const y = [255, 255, 0, 255]
  const b = [0, 0, 255, 255]

  // prettier-ignore
  const textureData = new Uint8Array(
    [
      _, _, _, _, _,
      _, y, _, _, _,
      _, y, _, _, _,
      _, y, y, _, _,
      _, y, _, _, _,
      _, y, y, y, _,
      b, _, _, _, _,
    ].flat(),
  )

  const texture = device.createTexture({
    size: [kTextureWidth, kTexureHeight],
    format: 'rgba8unorm',
    usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
  })

  device.queue.writeTexture(
    { texture },
    textureData,
    { bytesPerRow: kTextureWidth * 4 },
    { width: kTextureWidth, height: kTexureHeight },
  )

  const bindGroups: GPUBindGroup[] = []

  for (let i = 0; i < 8; ++i) {
    const sampler = device.createSampler({
      addressModeU: i & 1 ? 'repeat' : 'clamp-to-edge',
      addressModeV: i & 2 ? 'repeat' : 'clamp-to-edge',
      magFilter: i & 4 ? 'linear' : 'nearest',
    })

    const bindGroup = device.createBindGroup({
      layout: pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: sampler },
        { binding: 1, resource: texture.createView() },
      ],
    })

    bindGroups.push(bindGroup)
  }

  // const bindGroup = device.createBindGroup({
  //   layout: pipeline.getBindGroupLayout(0),
  //   entries: [
  //     { binding: 0, resource: sampler },
  //     { binding: 1, resource: texture.createView() },
  //   ],
  // })

  const renderPassDescriptor: GPURenderPassDescriptor = {
    label: 'our basic canvas renderPass',
    colorAttachments: [
      {
        view: context!.getCurrentTexture().createView(),
        clearValue: [0.3, 0.3, 0.3, 1],
        loadOp: 'clear',
        storeOp: 'store',
      },
    ],
  }

  const settings: GPUSamplerDescriptor = {
    addressModeU: 'repeat',
    addressModeV: 'repeat',
    magFilter: 'linear',
  }

  const addressOptions = ['repeat', 'clamp-to-edge']
  const filterOptions = ['nearest', 'linear']

  const gui = new GUI()
  Object.assign(gui.domElement.style, { right: '', left: '15px' })
  gui.add(settings, 'addressModeU', addressOptions).onChange(render)
  gui.add(settings, 'addressModeV', addressOptions).onChange(render)
  gui.add(settings, 'magFilter', filterOptions).onChange(render)

  function render() {
    const ndx =
      (settings.addressModeU === 'repeat' ? 1 : 0) +
      (settings.addressModeV === 'repeat' ? 2 : 0) +
      (settings.magFilter === 'linear' ? 4 : 0)
    const bindGroup = bindGroups[ndx]

    for (let attachment of renderPassDescriptor.colorAttachments) {
      if (!attachment) return
      attachment.view = context!.getCurrentTexture().createView()
    }

    if (!device) return

    const encoder = device.createCommandEncoder({
      label: 'render triangle encoder',
    })
    const pass = encoder.beginRenderPass(renderPassDescriptor)
    pass.setPipeline(pipeline)
    pass.setBindGroup(0, bindGroup)
    pass.draw(6) // call our vertex shader 3 times
    pass.end()

    const commandBuffer = encoder.finish()
    device.queue.submit([commandBuffer])
  }

  const observer = new ResizeObserver(entries => {
    for (const entry of entries) {
      const canvas = entry.target as HTMLCanvasElement
      const width = entry.contentBoxSize[0].inlineSize
      const height = entry.contentBoxSize[0].blockSize
      canvas.width = Math.max(
        1,
        Math.min(width, device.limits.maxTextureDimension2D),
      )
      canvas.height = Math.max(
        1,
        Math.min(height, device.limits.maxTextureDimension2D),
      )
      // re-render
      render()
    }
  })
  observer.observe(canvas)
}

function fail(msg: string) {
  // eslint-disable-next-line no-alert
  alert(msg)
}
