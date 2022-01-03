# How to use JSServe + WGLMakie

One can use JSServe and WGLMakie in Pluto, IJulia, Webpages - and Documenter!
It's possible to create interactive apps and dashboards, serve them on live webpages, or export them to static HTML.

TESTINGGGGGG22222

First, one should use the new Page mode for anything that displays multiple outputs, like Pluto/IJulia/Documenter.
This creates a single entry point, to connect to the Julia process and load dependencies.
For Documenter, the page needs to be set to `exportable=true, offline=true`.
Exportable has the effect of inlining all data & js dependencies, so that everything can be loaded in a single HTML object.
`offline=true` will make the Page not even try to connect to a running Julia
process, which makes sense for the kind of static export we do in Documenter.

```@example 1
using JSServe
Page(exportable=true, offline=true)
```

After the page got displayed by the frontend, we can start with creating plots and JSServe Apps:

```@example 1
using WGLMakie
# Set the default resolution to something that fits the Documenter theme
set_theme!(resolution=(800, 400))
scatter(1:4, color=1:4)
```

As you can see, the output is completely static, because we don't have a running Julia server, as it would be the case with e.g. Pluto.
To make the plot interactive, we will need to write more parts of WGLMakie in JS, which is an ongoing effort.
As you can see, the interactivity already keeps working for 3D:

```@example 1
N = 60
function xy_data(x, y)
    r = sqrt(x^2 + y^2)
    r == 0.0 ? 1f0 : (sin(r)/r)
end
l = range(-10, stop = 10, length = N)
z = Float32[xy_data(x, y) for x in l, y in l]
surface(
    -1..1, -1..1, z,
    colormap = :Spectral
)
```

There are a couple of ways to keep interacting with Plots in a static export.

## Record a statemap

JSServe allows to record a statemap for all widgets, that satisfy the following interface:

```julia
# must be true to be found inside the DOM
is_widget(x) = true
# Updating the widget isn't dependant on any other state (only thing supported right now)
is_independant(x) = true
# The values a widget can iterate
function value_range end
# updating the widget with a certain value (usually an observable)
function update_value!(x, value) end
```

Currently, only sliders overload the interface:

```@example 1
using Observables

App() do session::Session
    n = 10
    index_slider = Slider(1:n)
    volume = rand(n, n, n)
    slice = map(index_slider) do idx
        return volume[:, :, idx]
    end
    fig = Figure()
    ax, cplot = contour(fig[1, 1], volume)
    rectplot = linesegments!(ax, Rect(-1, -1, 12, 12), linewidth=2, color=:red)
    on(index_slider) do idx
        translate!(rectplot, 0,0,idx)
    end
    heatmap(fig[1, 2], slice)
    slider = DOM.div("z-index: ", index_slider, index_slider.value)
    return JSServe.record_states(session, DOM.div(slider, fig))
end
```

## Execute Javascript directly

JSServe makes it easy to build whole HTML and JS applications.
You can for example directly register javascript function that get run on change.

```@example 1
using JSServe: onjs

app = App() do session::Session
    s1 = Slider(1:100)
    slider_val = DOM.p(s1[]) # initialize with current value
    # call the `on_update` function whenever s1.value changes in JS:
    onjs(session, s1.value, js"""function on_update(new_value) {
        //interpolating of DOM nodes and other Julia values work mostly as expected:
        const p_element = $(slider_val)
        p_element.innerText = new_value
    }
    """)

    return DOM.div("slider 1: ", s1, slider_val)
end
```

One can also interpolate plots into JS and update those via JS.
The problem is, that there isn't an amazing interface yet.
The returned object is directly a THREE object, with all plot attributes converted into Javascript types.
The good news is, all attributes should be in either `three_scene.material.uniforms`, or `three_scene.geometry.attributes`.
Going forward, we should create an API in WGLMakie, that makes it as easy as in Julia: `plot.attribute = value`.
But while this isn't in place, logging the the returned object makes it pretty easy to figure out what to do - btw, the JS console + logging is amazing and makes it very easy to play around with the object once logged.

```@example 1
using JSServe: onjs, evaljs, on_document_load

app = App() do session::Session
    s1 = Slider(1:100)
    slider_val = DOM.p(s1[]) # initialize with current value

    fig, ax, splot = scatter(1:4)

    # With on_document_load one can run JS after everything got loaded.
    # This is an alternative to `evaljs`, which we can't use here,
    # since it gets run asap, which means the plots won't be found yet.

    on_document_load(session, js"""
        const plots = $(splot)
        const scatter_plot = plots[0]
        // open the console with ctr+shift+i, to inspect the values
        // tip - you can right click on the log and store the actual variable as a global, and directly interact with it to change the plot.
        console.log(scatter_plot)
        console.log(scatter_plot.material.uniforms)
        console.log(scatter_plot.geometry.attributes)
    """)

    # with the above, we can find out that the positions are stored in `offset`
    # (*sigh*, this is because threejs special cases `position` attributes so it can't be used)
    # Now, lets go and change them when using the slider :)
    onjs(session, s1.value, js"""function on_update(new_value) {
        const plots = $(splot)
        const scatter_plot = plots[0]

        // change first point x + y value
        scatter_plot.geometry.attributes.offset.array[0] = (new_value/100) * 4
        scatter_plot.geometry.attributes.offset.array[1] = (new_value/100) * 4
        // this always needs to be set of geometry attributes after an update
        scatter_plot.geometry.attributes.offset.needsUpdate = true
    }
    """)
    # and for got measures, add a slider to change the color:
    color_slider = Slider(LinRange(0, 1, 100))
    onjs(session, color_slider.value, js"""function on_update(hue) {
        const plot = $(splot)[0]
        const color = new THREE.Color()
        color.setHSL(hue, 1.0, 0.5)
        plot.material.uniforms.color.value.x = color.r
        plot.material.uniforms.color.value.y = color.g
        plot.material.uniforms.color.value.z = color.b
    }""")

    markersize = Slider(1:100)
    onjs(session, markersize.value, js"""function on_update(size) {
        const plot = $(splot)[0]
        plot.material.uniforms.markersize.value.x = size
        plot.material.uniforms.markersize.value.y = size
    }""")
    return DOM.div(s1, color_slider, markersize, fig)
end
```

This summarizes the current state of interactivity with WGLMakie inside static pages.

# Pluto/IJulia

Note that the normal interactivity from Makie is preserved with WGLMakie in e.g. Pluto, as long as the Julia session is running.
Which brings us to setting up Pluto/IJulia sessions! The return value of your first cell must be the return value of the function `Page`.
For example, your first cell can be

```julia
begin
	using JSServe
	Page()
end
```

As is common with files meant to be shared, you might wish to set up a temporary directory so as to not pollute other people's environment. The following code will also be a valid first cell.

```julia
begin
	using Pkg
	Pkg.activate(mktempdir())

	Pkg.add("JSServe")
	using JSServe
	Page()
end
```

If you're accessing the notebook from another PC, you must set:

```julia
begin
	using JSServe
	Page(listen_url="0.0.0.0")
end
```

For more advanced setups consult the `?Page` docs and `JSServe.configure_server!`.

## Styling

You may have noticed, styling isn't really amazing right now.
The good news is, that one can use the whole mighty power of the CSS/HTML universe.
If it wasn't clear so far, JSServe allows to load arbitrary css, and `DOM.xxx` wraps all existing HTML tags.

```@example 1
using Colors
using JSServe: rows

App() do session::Session

    hue_slider = Slider(0:360)
    color_swatch = DOM.div(class="h-6 w-6 p-2 m-2 rounded shadow")

    onjs(session, hue_slider.value, js"""function (hue){
        $(color_swatch).style.backgroundColor = "hsl(" + hue + ",60%,50%)"
    }""")

    return DOM.div(JSServe.TailwindCSS, rows(hue_slider, color_swatch))
end
```

Tailwind is quite a amazing and has a great documentation especially for CSS beginners:
https://tailwindcss.com/docs/

Note, that JSServe.TailwindCSS is nothing but:

```
TailwindCSS = JSServe.Asset("/path/to/tailwind.min.css")
```

So any other CSS file can be used.

It's also pretty easy to make reusable blocks from styled elements.
E.g. the `rows` function above is nothing but:

```julia
rows(args...; class="") = DOM.div(args..., class=class * " flex flex-row")
```

It would be more correct to define it as:

```julia
rows(args...; class="") = DOM.div(JSServe.TailwindCSS, args..., class=class * " flex flex-row")
```

JSServe will then make sure, that `JSServe.TailwindCSS` is loaded, and will only load it once!

Finally, lets create a styled, reusable card componenent:

```@example 1
using Markdown

struct GridCard
    elements::Any
end

GridCard(elements...) = GridCard(elements)

function JSServe.jsrender(card::GridCard)
    return DOM.div(JSServe.TailwindCSS, card.elements..., class="rounded-lg p-2 m-2 shadow-lg grid auto-cols-max grid-cols-2 gap-4")
end

App() do session::Session
    # We can now use this wherever we want:
    fig = Figure(resolution=(200, 200))
    contour(fig[1,1], rand(4,4))
    card = GridCard(
        Slider(1:100),
        DOM.h1("hello"),
        DOM.img(src="https://julialang.org/assets/infra/logo.svg"),
        fig
    )
    # Markdown creates a DOM as well, and you can interpolate
    # arbitrary jsrender'able elements in there:
    return md"""

    # Wow, Markdown works as well?

    $(card)

    """
end
```

Hopefully, over time there will be helper libraries with lots of stylised elements like the above, to make flashy dashboards with JSServe + WGLMakie.

# Troubleshooting

## Plots don't display in Safari

Safari users may need to [enable](https://discussions.apple.com/thread/8655829) WebGL.

# Plotting Graphs with `GraphMakie.jl`
## The `graphplot` Command
Plotting your first `AbstractGraph` from [`Graphs.jl`](https://github.com/JuliaGraphs/Graphs.jl)
is as simple as

````@example index
using CairoMakie
CairoMakie.activate!(type="png") # hide
set_theme!(resolution=(800, 400)) #hide
CairoMakie.inline!(true) # hide
using GraphMakie
using Graphs
import Random; Random.seed!(2) # hide

g = wheel_graph(10)
f, ax, p = graphplot(g)
hidedecorations!(ax); hidespines!(ax)
ax.aspect = DataAspect()
f # hide
````

The `graphplot` command is a recipe which wraps several steps
- layout the graph in space using a layout function,
- create a `scatter` plot for the nodes and
- create a `linesegments` plot for the edges.
The default layout is `Spring()` from
[`NetworkLayout.jl`](https://github.com/JuliaGraphs/NetworkLayout.jl). The
layout attribute can be any function which takes an `AbstractGraph` and returns
a list of `Point{dim,Ptype}` (see [`GeometryBasics.jl`](https://github.com/JuliaGeometry/GeometryBasics.jl)
objects where `dim` determines the dimensionality of the plot.
Besides that there are some common attributes which are forwarded to the
underlying plot commands. See [`graphplot`](@ref).

````@example index
using GraphMakie.NetworkLayout

g = SimpleGraph(5)
add_edge!(g, 1, 2); add_edge!(g, 2, 4);
add_edge!(g, 4, 3); add_edge!(g, 3, 2);
add_edge!(g, 2, 5); add_edge!(g, 5, 4);
add_edge!(g, 4, 1); add_edge!(g, 1, 5);

# define some edge colors
edgecolors = [:black for i in 1:ne(g)]
edgecolors[4] = edgecolors[7] = :red

f, ax, p = graphplot(g, layout=Shell(),
                     node_color=[:black, :red, :red, :red, :black],
                     edge_color=edgecolors)

hidedecorations!(ax); hidespines!(ax)
ax.aspect = DataAspect()
f #hide
````

We can interactively change the attributes as usual with Makie.

````@example index
fixed_layout(_) = [(0,0), (0,1), (0.5, 1.5), (1,1), (1,0)]
# set new layout
p.layout = fixed_layout; autolimits!(ax)
# change edge width & color
p.edge_width = 5.0
p.edge_color[][3] = :green;
p.edge_color = p.edge_color[] # trigger observable
f #hide
````

## Adding Node Labels

````@example index
Random.seed!(2)
g = wheel_graph(10)

colors = [:black for i in 1:nv(g)]
colors[1] = :red

f, ax, p = graphplot(g,
                     nlabels=repr.(1:nv(g)),
                     nlabels_color=colors,
                     nlabels_align=(:center,:center))
hidedecorations!(ax); hidespines!(ax); ax.aspect = DataAspect()
f # hide
````

This is not very nice, lets change the offsets based on the `node_positions`

````@example index
offsets = 0.15 * (p[:node_pos][] .- p[:node_pos][][1])
offsets[1] = Point2f(0, 0.3)
p.nlabels_offset[] = offsets
autolimits!(ax)
f # hide
````

## Adding Edge Labels

````@example index
Random.seed!(42)
g = barabasi_albert(6, 2)

labels =  repr.(1:ne(g))

f, ax, p = graphplot(g, elabels=labels,
                     elabels_color=[:black for i in 1:ne(g)],
                     edge_color=[:black for i in 1:ne(g)])
hidedecorations!(ax); hidespines!(ax); ax.aspect = DataAspect()
f # hide
````

The position of the edge labels is determined by several plot arguments.
All possible arguments are described in the docs of the [`graphplot`](@ref) function.
Basicially, each label is placed in the middle of the edge and rotated to match the edge rotation.
The rotaion for each label can be overwritten with the `elabels_rotation` argument.

````@example index
p.elabels_rotation[] = Vector{Union{Nothing, Float64}}(nothing, ne(g))
p.elabels_rotation[][5] = 0.0 # set absolute rotation angle for label 5
p.elabels_rotation[] = p.elabels_rotation[]
nothing #hide
````

One can shift the label along the edge with the `elabels_shift` argument and determine the distance
in pixels using the `elabels_distance` argument.

````@example index
p.elabels_opposite[] = [1,2,8,6]

p.elabels_offset[] = [Point2f(0.0, 0.0) for i in 1:ne(g)]
p.elabels_offset[][5] = Point2f(-0.4,0)
p.elabels_offset[] = p.elabels_offset[]

p.elabels_shift[] = [0.5 for i in 1:ne(g)]
p.elabels_shift[][1] = 0.6
p.elabels_shift[][7] = 0.4
p.elabels_shift[] = p.elabels_shift[]

p.elabels_distance[] = zeros(ne(g))
p.elabels_distance[][8] = 15
p.elabels_distance[] = p.elabels_distance[]

f # hide
````

## Indicate Edge Direction
It is possible to put arrows on the edges using the `arrow_show` parameter. This parameter
is `true` for `SimpleDiGraph` by default. The position and size of each arrowhead can be
change using the `arrow_shift` and `arrow_size` parameters.

````@example index
g = wheel_digraph(10)
arrow_size = [10+i for i in 1:ne(g)]
arrow_shift = range(0.1, 0.8, length=ne(g))
f, ax, p = graphplot(g; arrow_size, arrow_shift)
hidedecorations!(ax); hidespines!(ax); ax.aspect = DataAspect()
f # hide
````

## Self edges
A self edge in a graph will be displayed as a loop.
!!! note
    Selfe edges are not possible in 3D plots yet.

````@example index
g = complete_graph(3)
add_edge!(g, 1, 1)
add_edge!(g, 2, 2)
add_edge!(g, 3, 3)
f, ax, p = graphplot(g)

hidedecorations!(ax); hidespines!(ax); ax.aspect = DataAspect()
f # hide
````

It is possible to change the appearance using the `selfedge_` attributes:

````@example index
p.selfedge_size = Dict(1=>Makie.automatic, 4=>3.6, 6=>0.5) #idx as in edges(g)
p.selfedge_direction = Point2f(0.3, 1)
p.selfedge_width = Any[Makie.automatic for i in 1:ne(g)]
p.selfedge_width[][4] = 0.6*π; notify(p.selfedge_width)
autolimits!(ax)
f # hide
````

## Curvy edges
Curvy edges are possible using the low level interface of passing tangent
vectors and a `tfactor`. The tangent vectors can be `nothing` (straight line) or
two vectors per edge (one for src vertex, one for dst vertex). The `tfactor`
scales the distance of the bezier control point relative to the distance of src
and dst nodes. For real world usage see the [AST of a Julia function](@ref) example.

````@example index
using GraphMakie: plot_controlpoints!
g = complete_graph(3)
tangents = Dict(1 => ((1,1),(0,-1)),
                2 => ((0,1),(0,-1)),
                3 => ((0,-1),(1,0)))
tfactor = [0.5, 0.75, (0.5, 0.25)]
f, ax, p = graphplot(g; layout=SquareGrid(cols=3), tangents, tfactor,
                     arrow_size=20, arrow_show=true, edge_color=[:red, :green, :blue],
                     elabels="Edge ".*repr.(1:ne(g)), elabels_distance=10)
hidedecorations!(ax); hidespines!(ax); ax.aspect = DataAspect()
plot_controlpoints!(ax, p) # show control points for demonstration
f # hide
````

## Edge waypoints
It is possible to specify waypoints per edge which needs to be crossed. See the
[Dependency Graph of a Package](@ref) example.
If the attribute `waypoint_radius` is `nothing` or `:spline` the waypoints will be crossed
using natural cubic spline interpolation. If the supply a radius the waypoints won't be reached,
instead they will be connected with straight lines which bend in the given radius around the
waypoints.

````@example index
set_theme!(resolution=(800, 800)) #hide
g = SimpleGraph(8); add_edge!(g, 1, 2); add_edge!(g, 3, 4); add_edge!(g, 5, 6); add_edge!(g, 7, 8)

waypoints = Dict(1 => [(.25,  0.25), (.75, -0.25)],
                 2 => [(.25, -0.25), (.75, -0.75)],
                 3 => [(.25, -0.75), (.75, -1.25)],
                 4 => [(.25, -1.25), (.75, -1.75)])
waypoint_radius = Dict(1 => nothing,
                       2 => 0,
                       3 => 0.05,
                       4 => 0.15)

f = Figure(); f[1,1] = ax = Axis(f)
using Makie.Colors # hide
for i in 3:4 #hide
    poly!(ax, Circle(Point2f(waypoints[i][1]), waypoint_radius[i]), color=RGBA(0.0,0.44705883,0.69803923,0.2)) #hide
    poly!(ax, Circle(Point2f(waypoints[i][2]), waypoint_radius[i]), color=RGBA(0.0,0.44705883,0.69803923,0.2)) #hide
end #hide

p = graphplot!(ax, g; layout=SquareGrid(cols=2, dy=-0.5),
               waypoints, waypoint_radius,
               nlabels=["","r = nothing (equals :spline)",
                        "","r = 0 (straight lines)",
                        "","r = 0.05 (in data space)",
                        "","r = 0.1"],
               nlabels_distance=30, nlabels_align=(:left,:center))

for i in 1:4 #hide
    scatter!(ax, waypoints[i], color=RGBA(0.0,0.44705883,0.69803923,1.0)) #hide
end #hide
xlims!(ax, (-0.1, 2.25)), hidedecorations!(ax); hidespines!(ax); ax.aspect = DataAspect()
f # hide
````

## Plot Graphs in 3D
If the layout returns points in 3 dimensions, the plot will be in 3D. However this is a bit
experimental. Feel free to file an issue if there are any problems.

````@example index
set_theme!(resolution=(800, 800)) #hide
g = smallgraph(:cubical)
elabels_shift = [0.5 for i in 1:ne(g)]
elabels_shift[[2,7,8,9]] .= 0.3
elabels_shift[10] = 0.25
graphplot(g; layout=Spring(dim=3, seed=5),
          elabels="Edge ".*repr.(1:ne(g)),
          elabels_textsize=12,
          elabels_opposite=[3,5,7,8,12],
          elabels_shift,
          elabels_distance=3,
          arrow_show=true,
          arrow_shift=0.9,
          arrow_size=15)
````

Using [`JSServe.jl`](https://github.com/SimonDanisch/JSServe.jl) and [`WGLMakie.jl`](https://github.com/JuliaPlots/WGLMakie.jl)
we can also add some interactivity:

````@example index
using JSServe
Page(exportable=true, offline=true)
````

````@example index
using WGLMakie
WGLMakie.activate!()
set_theme!(resolution=(800, 600))
g = smallgraph(:dodecahedral)
graphplot(g, layout=Spring(dim=3), node_size=100)
````