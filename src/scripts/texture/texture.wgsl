struct OurVertexShaderOutput {
    @builtin(position) position: vec4f,
    @location(0) texcoord: vec2f,
};

@vertex fn vs(
    @builtin(vertex_index) vertexIndex: u32
) -> OurVertexShaderOutput {
    let pos = array(
    vec2f(0., 0.),
    vec2f(1., 0.),
    vec2f(0., 1.),

    vec2f(0., 1.),
    vec2f(1., 0.),
    vec2f(1., 1.),
    );

    var vsOutput: OurVertexShaderOutput;
    let xy = pos[vertexIndex];
    vsOutput.position = vec4f(xy, 0., 1.);
    vsOutput.texcoord = xy;

    return vsOutput;
}

@group(0) @binding(0) var ourSampler: sampler;
@group(0) @binding(1) var ourTexture: texture_2d<f32>;

@fragment fn fs(fsInput: OurVertexShaderOutput) -> @location(0) vec4f {
    return textureSample(ourTexture, ourSampler, fsInput.texcoord);
}
