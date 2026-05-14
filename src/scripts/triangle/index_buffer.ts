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

type RgbColor = [number, number, number]

function createCircleVertices({
  radius = 1,
  numSubdivisions = 24,
  innerRadius = 0,
  startAngle = 0,
  endAngle = Math.PI * 2,
} = {}) {
  // 2 triangles per subdivision, 3 verts per tri
  const numVertices = (numSubdivisions + 1) * 2
  // 2 32-bit values for position (xy) and 1 32-bit value for color (rgb_)
  // The 32-bit color value will be written/read as 4 8-bit values
  const vertexData = new Float32Array(numVertices * (2 + 1))
  const colorData = new Uint8Array(vertexData.buffer)

  let offset = 0
  let colorOffset = 8
  const addVertex = (x: number, y: number, r: number, g: number, b: number) => {
    vertexData[offset++] = x
    vertexData[offset++] = y
    offset += 1
    colorData[colorOffset++] = r * 255
    colorData[colorOffset++] = g * 255
    colorData[colorOffset++] = b * 255
    colorOffset += 9 // skip extra byte and the position
  }

  const innerColor: RgbColor = [1, 1, 1]
  const outerColor: RgbColor = [0.1, 0.1, 0.1]

  // 2 vertices per subdivision
  //
  // 0  2  4  6  8 ...
  //
  // 1  3  5  7  9 ...
  for (let i = 0; i < numSubdivisions; ++i) {
    // prettier-ignore
    const angle =
      startAngle + (i + 0) * (endAngle - startAngle) / numSubdivisions

    const c1 = Math.cos(angle)
    const s1 = Math.sin(angle)

    addVertex(c1 * radius, s1 * radius, ...outerColor)
    addVertex(c1 * innerRadius, s1 * innerRadius, ...innerColor)
  }

  const indexData = new Uint32Array(numSubdivisions * 6)
  let ndx = 0

  // 0---2---4---...
  // | //| //|
  // |// |// |//
  // 1---3-- 5---...
  for (let i = 0; i < numSubdivisions; ++i) {
    const ndxOffset = i * 2

    // first triagle
    indexData[ndx++] = ndxOffset
    indexData[ndx++] = ndxOffset + 1
    indexData[ndx++] = ndxOffset + 2

    // second triangle
    indexData[ndx++] = ndxOffset + 2
    indexData[ndx++] = ndxOffset + 1
    indexData[ndx++] = ndxOffset + 3
  }

  return { vertexData, indexData, numVertices: indexData.length }
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
    label: 'per vertex color',
    layout: 'auto',
    vertex: {
      module,
      buffers: [
        {
          arrayStride: 2 * 4 + 4, // 2 floats, 4 bytes each + 4 bytes
          attributes: [
            { shaderLocation: 0, offset: 0, format: 'float32x2' }, // position
            { shaderLocation: 4, offset: 8, format: 'unorm8x4' }, // perVertexColor
          ], // position
        },
        {
          arrayStride: 4 + 2 * 4, // 4 bytes + 2 floats, 4 bytes each
          stepMode: 'instance',
          attributes: [
            { shaderLocation: 1, offset: 0, format: 'unorm8x4' }, // color
            { shaderLocation: 2, offset: 4, format: 'float32x2' }, // offset
          ],
        },
        {
          arrayStride: 2 * 4, // 2 floats, 4 bytes each
          stepMode: 'instance',
          attributes: [
            { shaderLocation: 3, offset: 0, format: 'float32x2' }, // scale
          ],
        },
      ],
    },
    fragment: {
      module,
      targets: [{ format: presentationFormat }],
    },
  })

  const kNumObjects = 100
  const objectInfos: {
    scale: number
  }[] = []

  const staticUnitSize =
    4 + // color is 4 bytes
    2 * 4 // offset is 2 32bit floats (4bytes each)
  const changingUnitSize = 2 * 4 // scale is 2 32bit floats (4bytes each)

  const staticVertexBufferSize = staticUnitSize * kNumObjects
  const changingVertexBufferSize = changingUnitSize * kNumObjects

  const staticVertexBuffer = device.createBuffer({
    label: 'static vertex for objects',
    size: staticVertexBufferSize,
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
  })

  const changingVertexBuffer = device.createBuffer({
    label: 'changing vertex for objects',
    size: changingVertexBufferSize,
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
  })

  const kColorOffset = 0
  const kOffsetOffset = 1
  const kScaleOffset = 0

  {
    const staticVertexValuesU8 = new Uint8Array(staticVertexBufferSize)
    const staticVertexValuesF32 = new Float32Array(staticVertexValuesU8.buffer)
    for (let i = 0; i < kNumObjects; ++i) {
      const staticOffsetU8 = i * staticUnitSize
      const staticOffsetF32 = staticOffsetU8 / 4

      staticVertexValuesU8.set(
        [rand() * 255, rand() * 255, rand() * 255, 255],
        staticOffsetU8 + kColorOffset,
      )
      staticVertexValuesF32.set(
        [rand(-0.9, 0.9), rand(-0.9, 0.9)],
        staticOffsetF32 + kOffsetOffset,
      )

      objectInfos.push({ scale: rand(0.2, 0.5) })
    }

    device.queue.writeBuffer(staticVertexBuffer, 0, staticVertexValuesF32)
  }

  // a typed array we can use to update the changingVertexBuffer
  const vertexValues = new Float32Array(changingVertexBufferSize / 4)

  // setup a storage buffer with vertex data
  const { vertexData, indexData, numVertices } = createCircleVertices({
    radius: 0.5,
    innerRadius: 0.25,
  })

  const vertexBuffer = device.createBuffer({
    label: 'vertex buffer',
    size: vertexData.byteLength,
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
  })
  device.queue.writeBuffer(vertexBuffer, 0, vertexData)
  const indexBuffer = device.createBuffer({
    label: 'index buffer',
    size: indexData.byteLength,
    usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
  })
  device.queue.writeBuffer(indexBuffer, 0, indexData)

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
    pass.setVertexBuffer(0, vertexBuffer)
    pass.setVertexBuffer(1, staticVertexBuffer)
    pass.setVertexBuffer(2, changingVertexBuffer)
    pass.setIndexBuffer(indexBuffer, 'uint32')

    const aspect = canvas.width / canvas.height

    objectInfos.forEach(({ scale }, ndx) => {
      const offset = ndx * (changingUnitSize / 4)
      vertexValues.set([scale / aspect, scale], offset + kScaleOffset)
    })

    device.queue.writeBuffer(changingVertexBuffer, 0, vertexValues)

    pass.drawIndexed(numVertices, kNumObjects)

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
