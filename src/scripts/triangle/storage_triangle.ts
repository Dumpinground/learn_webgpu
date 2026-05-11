import wgsl from './storage_triangle.wgsl?raw'

function rand(min?: number, max?: number) {
  if (!min) {
    min = 0
    max = 1
  } else if (!max) {
    max = min
    min = 0
  }
  return min + Math.random() * (max - min)
}

export async function main(canvas: HTMLCanvasElement) {
  const adapter = await navigator.gpu?.requestAdapter()
  const device = await adapter?.requestDevice()
  if (!device) {
    console.log('need a browser that supports WebGPU')
    return
  }

  const context = canvas.getContext('webgpu')
  const presentationFormat = navigator.gpu.getPreferredCanvasFormat()
  context?.configure({
    device,
    format: presentationFormat,
  })

  const module = device.createShaderModule({
    code: wgsl,
  })

  const pipeline = device.createRenderPipeline({
    label: 'multiple uniform buffer',
    layout: 'auto',
    vertex: { module },
    fragment: {
      module,
      targets: [{ format: presentationFormat }],
    },
  })

  // const uniformBufferSize = 4 * 4 + 2 * 4 + 2 * 4
  const staticUniformBufferSize = 4 * 4 + 2 * 4 + 2 * 4
  const uniformBufferSize = 2 * 4

  const kColorOffset = 0
  const kOffsetOffset = 4

  const kScaleOffset = 0

  const kNumObjects = 100
  const objectInfos: {
    scale: number
    bindGroup: GPUBindGroup
    uniformBuffer: GPUBuffer
    uniformValues: Float32Array<ArrayBuffer>
  }[] = []

  for (let i = 0; i < kNumObjects; ++i) {
    const staticUniformBuffer = device.createBuffer({
      label: `static uniforms for obj: ${i}`,
      size: staticUniformBufferSize,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    })

    {
      const uniformValues = new Float32Array(staticUniformBufferSize / 4)
      uniformValues.set([rand(), rand(), rand(), 1], kColorOffset)
      uniformValues.set([rand(-0.9, 0.9), rand(-0.9, 0.9)], kOffsetOffset)
      device.queue.writeBuffer(staticUniformBuffer, 0, uniformValues)
    }

    const uniformValues = new Float32Array(uniformBufferSize / 4)
    const uniformBuffer = device.createBuffer({
      label: `changing uniforms for obj: ${i}`,
      size: uniformBufferSize,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    })

    const bindGroup = device.createBindGroup({
      label: `bind group for obj: ${i}`,
      layout: pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: staticUniformBuffer },
        { binding: 1, resource: uniformBuffer },
      ],
    })

    objectInfos.push({
      scale: rand(0.2, 0.5),
      uniformBuffer,
      uniformValues,
      bindGroup,
    })
  }

  const renderPassDescriptor: GPURenderPassDescriptor = {
    label: 'our basic canvas renderPass',
    // colorAttachments: [],
    colorAttachments: [
      {
        view: context!.getCurrentTexture().createView(),
        clearValue: [0.3, 0.3, 0.3, 1],
        loadOp: 'clear',
        storeOp: 'store',
      },
    ],
  }

  function render() {
    if (!device) return

    for (let attachment of renderPassDescriptor.colorAttachments) {
      if (!attachment) return
      attachment.view = context!.getCurrentTexture().createView()
    }

    const encoder = device.createCommandEncoder({ label: 'our encoder' })

    if (!encoder) return

    const pass = encoder.beginRenderPass(renderPassDescriptor)
    pass.setPipeline(pipeline)

    const aspect = canvas.width / canvas.height

    for (const {
      scale,
      bindGroup,
      uniformBuffer,
      uniformValues,
    } of objectInfos) {
      uniformValues.set([scale / aspect, scale], kScaleOffset)
      device.queue.writeBuffer(uniformBuffer, 0, uniformValues)
      pass.setBindGroup(0, bindGroup)
      pass.draw(3)
    }

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
    }
    render()
  })

  observer.observe(canvas)
}
