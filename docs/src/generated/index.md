```@meta
EditURL = "<unknown>/../WGLMakie.jl/docs/index.jl"
```

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
using Colors # hide
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

OUTPUT = joinpath(@__DIR__, "src", "generated")
isdir(OUTPUT) && rm(OUTPUT, recursive=true)
mkpath(OUTPUT)

Literate.markdown("C:\\Users\\kool7\\Google Drive\\WGLMakie.jl\\docs\\index.jl", OUTPUT)

---

*This page was generated using [Literate.jl](https://github.com/fredrikekre/Literate.jl).*

