using Documenter, WGLMakie, JSServe

makedocs(; modules=[WGLMakie], format=Documenter.HTML(), pages=["Home" => "index.md"],
         repo="https://github.com/kool7d/WGLMakie.jl",
         sitename="WGLMakie.jl", authors="Dan Kool")

deploydocs(; repo="github.com/kool7d/WGLMakie.jl", push_preview=true)
