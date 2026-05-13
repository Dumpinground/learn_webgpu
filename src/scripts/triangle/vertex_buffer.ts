import wgsl from './vertex_buffer.wgsl?raw'

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

function createCircleVertices({
  radius = 1,
  numSubdivisions = 24,
  innerRadius = 0,
  startAngle = 0,
  endAngle = Math.PI * 2,
} = {}) {
  // 2 triangles per subdivision, 3 verts per tri, 2 values (xy) each.
  const numVertices = numSubdivisions * 3 * 2
  const vertexData = new Float32Array(numSubdivisions * 2 * 3 * 2)

  let offset = 0
  const addVertex = (x: number, y: number) => {
    vertexData[offset++] = x
    vertexData[offset++] = y
  }

  // 2 vertices per subdivision
  //
  // 0--1 4
  // | / /|
  // |/ / |
  // 2 3--5
  for (let i = 0; i < numSubdivisions; ++i) {
    // prettier-ignore
    const angle1 =
      startAngle + (i + 0) * (endAngle - startAngle) / numSubdivisions
    // prettier-ignore
    const angle2 =
      startAngle + (i + 1) * (endAngle - startAngle) / numSubdivisions

    const c1 = Math.cos(angle1)
    const s1 = Math.sin(angle1)
    const c2 = Math.cos(angle2)
    const s2 = Math.sin(angle2)

    // first triangle
    addVertex(c1 * radius, s1 * radius)
    addVertex(c2 * radius, s2 * radius)
    addVertex(c1 * innerRadius, s1 * innerRadius)

    // second triangle
    addVertex(c1 * innerRadius, s1 * innerRadius)
    addVertex(c2 * radius, s2 * radius)
    addVertex(c2 * innerRadius, s2 * innerRadius)
  }

  return { vertexData, numVertices }
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
    label: 'vertex buffer vertices',
    layout: 'auto',
    vertex: { module },
    fragment: {
      module,
      targets: [{ format: presentationFormat }],
    },
  })

  const kNumObjects = 100
  const objectInfos: {
    scale: number
  }[] = []

  const staticUnitSize = 4 * 4 + 2 * 4 + 2 * 4
  const changingUnitSize = 2 * 4

  const staticStorageBufferSize = staticUnitSize * kNumObjects
  const changingStorageBufferSize = changingUnitSize * kNumObjects

  const staticStorageBuffer = device.createBuffer({
    label: 'static storage for objects',
    size: staticStorageBufferSize,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
  })

  const changingStorageBuffer = device.createBuffer({
    label: 'changing storage for objects',
    size: changingStorageBufferSize,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
  })

  const kColorOffset = 0
  const kOffsetOffset = 4
  const kScaleOffset = 0

  {
    const staticStorageValues = new Float32Array(staticStorageBufferSize / 4)
    for (let i = 0; i < kNumObjects; ++i) {
      const staticOffset = i * (staticUnitSize / 4)

      staticStorageValues.set(
        [rand(), rand(), rand(), 1],
        staticOffset + kColorOffset,
      )
      staticStorageValues.set(
        [rand(-0.9, 0.9), rand(-0.9, 0.9)],
        staticOffset + kOffsetOffset,
      )

      objectInfos.push({ scale: rand(0.2, 0.5) })
    }

    device.queue.writeBuffer(staticStorageBuffer, 0, staticStorageValues)
  }

  // a typed array we can use to update the changingStorageBuffer
  const storageValues = new Float32Array(changingStorageBufferSize / 4)

  // setup a storage buffer with vertex data
  const { vertexData, numVertices } = createCircleVertices({
    radius: 0.5,
    innerRadius: 0.25,
  })

  const vertexStorageBuffer = device.createBuffer({
    label: 'storage buffer vertices',
    size: vertexData.byteLength,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
  })
  device.queue.writeBuffer(vertexStorageBuffer, 0, vertexData)

  const bindGroup = device.createBindGroup({
    label: `bind group for objects`,
    layout: pipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: staticStorageBuffer },
      { binding: 1, resource: changingStorageBuffer },
      { binding: 2, resource: vertexStorageBuffer },
    ],
  })

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

    objectInfos.forEach(({ scale }, ndx) => {
      const offset = ndx * (changingUnitSize / 4)
      storageValues.set([scale / aspect, scale], offset + kScaleOffset)
    })

    device.queue.writeBuffer(changingStorageBuffer, 0, storageValues)

    pass.setBindGroup(0, bindGroup)
    pass.draw(numVertices, kNumObjects)

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
