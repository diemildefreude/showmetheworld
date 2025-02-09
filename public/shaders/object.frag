
precision highp float;  
uniform float u_time;
uniform float u_timeMultX;
uniform float u_timeMultY;
uniform sampler2D u_tex;
uniform float u_alpha;
uniform float u_vignetteWidth;
uniform float u_vignetteStart;
uniform float u_brightness;
uniform float u_contrast;
uniform vec3 u_tint;

varying vec2 vUv; 

float circle(vec2 st, vec2 resolution, float radius)
{
    // Normalize st for aspect ratio
    vec2 aspectCorrect = st * resolution;
    aspectCorrect.x *= resolution.x / resolution.y;

    // Calculate distance from the center
    vec2 dist = aspectCorrect - vec2(0.5 * resolution.x, 0.5 * resolution.y);

    // Return the vignette effect based on the distance
    return 1.0 - smoothstep(radius - radius * u_vignetteWidth,
    radius + radius * u_vignetteWidth,
    dot(dist, dist * u_vignetteStart));
}

void uvWave(inout vec2 uv)
{
    float amp = 0.05;
    float freq = 0.5;    
    uv.x = 0.5 * (1.0 + amp * sin(freq * uv.y + u_time * u_timeMultX)) + (1.0 - amp) * (uv.x - 0.5);
    uv.y = 0.5 * (1.0 + amp * sin(freq * uv.x + u_time * u_timeMultY)) + (1.0 - amp) * (uv.y - 0.5);
}

float monochrome(vec3 color)
{
    float mono = (0.2125 * color.r) + (0.7154 * color.g) + (0.0721 * color.b);
    return mono;
}

float applyContrast(float mono)
{
    float c = pow(mono + u_brightness, u_contrast);
    return c;
    // if(u_contrast > 18.)
    // {
    //     float t = (u_contrast - 18.) / 2.;
    //     float stepMono = step(0.5, c);
    //     c = mix(c, stepMono, t);
    // }
    // return c;
}
void main() 
{  
  	vec2 uv = vUv;

    float radius = 1.0;
    float vignette = circle(uv, vec2(1.0, 1.0), radius);
    
    //uvWave(uv);    
    
    vec3 basic = texture2D(u_tex, uv).rgb;
    float m = monochrome(basic);
    float con = applyContrast(m);
    vec3 clr = vec3(con);

    // vec3 clrA = gradientBlur(uv, u_blurStrength * 1.0);
    // vec3 clrB = simpleGaussian(uv, u_blurStrength * 0.2);
    // vec3 clr = u_isTextureGrad ? clrA : clrB;
    vec3 tinted = clr * u_tint;
    vec3 halfTinted = mix(basic, tinted, 0.1);
    float alpha = vignette * u_alpha;
    gl_FragColor = vec4(halfTinted, alpha);
    //gl_FragColor = vec4(tinted, alpha);

    //gl_FragColor = vec4(clr, u_alpha);
}