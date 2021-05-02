var documenterSearchIndex = {"docs":
[{"location":"#How-to-use-JSServe-WGLMakie","page":"Home","title":"How to use JSServe + WGLMakie","text":"","category":"section"},{"location":"","page":"Home","title":"Home","text":"One can use JSServe and WGLMakie in Pluto, IJulia, Webpages - and Documenter! It's possible to create interactive apps and dashboards, serve them on live webpages, or export them to static HTML.","category":"page"},{"location":"","page":"Home","title":"Home","text":"This tutorial will run through the different modes and what kind of limitations to expect.","category":"page"},{"location":"","page":"Home","title":"Home","text":"First, one should use the new Page mode for anything that displays multiple outputs, like Pluto/IJulia/Documenter. This creates a single entry point, to connect to the Julia process and load dependencies. For Documenter, the page needs to be set to exportable=true, offline=true. Exportable has the effect of inlining all data & js dependencies, so that everything can be loaded in a single HTML object. offline=true will make the Page not even try to connect to a running Julia process, which makes sense for the kind of static export we do in Documenter.","category":"page"},{"location":"","page":"Home","title":"Home","text":"using JSServe\nPage(exportable=true, offline=true)","category":"page"},{"location":"","page":"Home","title":"Home","text":"After the page got displayed by the frontend, we can start with creating plots and JSServe Apps:","category":"page"},{"location":"","page":"Home","title":"Home","text":"using WGLMakie\n# Set the default resolution to something that fits the Documenter theme\nset_theme!(resolution=(800, 400))\nscatter(1:4, color=1:4)","category":"page"},{"location":"","page":"Home","title":"Home","text":"As you can see, the output is completely static, because we don't have a running Julia server, as it would be the case with e.g. Pluto. To make the plot interactive, we will need to write more parts of WGLMakie in JS, which is an ongoing effort. As you can see, the interactivity already keeps working for 3D:","category":"page"},{"location":"","page":"Home","title":"Home","text":"N = 60\nfunction xy_data(x, y)\n    r = sqrt(x^2 + y^2)\n    r == 0.0 ? 1f0 : (sin(r)/r)\nend\nl = range(-10, stop = 10, length = N)\nz = Float32[xy_data(x, y) for x in l, y in l]\nsurface(\n    -1..1, -1..1, z,\n    colormap = :Spectral\n)","category":"page"},{"location":"","page":"Home","title":"Home","text":"There are a couple of ways to keep interacting with Plots in a static export.","category":"page"},{"location":"#Record-a-statemap","page":"Home","title":"Record a statemap","text":"","category":"section"},{"location":"","page":"Home","title":"Home","text":"JSServe allows to record a statemap for all widgets, that satisfy the following interface:","category":"page"},{"location":"","page":"Home","title":"Home","text":"# must be true to be found inside the DOM\nis_widget(x) = true\n# Updating the widget isn't dependant on any other state (only thing supported right now)\nis_independant(x) = true\n# The values a widget can iterate\nfunction value_range end\n# updating the widget with a certain value (usually an observable)\nfunction update_value!(x, value) end","category":"page"},{"location":"","page":"Home","title":"Home","text":"Currently, only sliders overload the interface:","category":"page"},{"location":"","page":"Home","title":"Home","text":"using Observables\n\nApp() do session::Session\n    n = 10\n    index_slider = Slider(1:n)\n    volume = rand(n, n, n)\n    slice = map(index_slider) do idx\n        return volume[:, :, idx]\n    end\n    fig = Figure()\n    ax, cplot = contour(fig[1, 1], volume)\n    rectplot = linesegments!(ax, Rect(-1, -1, 12, 12), linewidth=50, color=:red)\n    on(index_slider) do idx\n        translate!(rectplot, 0,0,idx)\n    end\n    heatmap(fig[1, 2], slice)\n    slider = DOM.div(\"z-index: \", index_slider, index_slider.value)\n    return JSServe.record_states(session, DOM.div(slider, fig))\nend","category":"page"},{"location":"#Execute-Javascript-directly","page":"Home","title":"Execute Javascript directly","text":"","category":"section"},{"location":"","page":"Home","title":"Home","text":"JSServe makes it easy to build whole HTML and JS applications. You can for example directly register javascript function that get run on change.","category":"page"},{"location":"","page":"Home","title":"Home","text":"using JSServe: onjs\n\napp = App() do session::Session\n    s1 = Slider(1:100)\n    slider_val = DOM.p(s1[]) # initialize with current value\n    # call the `on_update` function whenever s1.value changes in JS:\n    onjs(session, s1.value, js\"\"\"function on_update(new_value) {\n        //interpolating of DOM nodes and other Julia values work mostly as expected:\n        const p_element = $(slider_val)\n        p_element.innerText = new_value\n    }\n    \"\"\")\n\n    return DOM.div(\"slider 1: \", s1, slider_val)\nend","category":"page"},{"location":"","page":"Home","title":"Home","text":"One can also interpolate plots into JS and update those via JS. The problem is, that there isn't an amazing interface yet. The returned object is directly a THREE object, with all plot attributes converted into Javascript types. The good news is, all attributes should be in either three_scene.material.uniforms, or three_scene.geometry.attributes. Going forward, we should create an API in WGLMakie, that makes it as easy as in Julia: plot.attribute = value. But while this isn't in place, logging the the returned object makes it pretty easy to figure out what to do - btw, the JS console + logging is amazing and makes it very easy to play around with the object once logged.","category":"page"},{"location":"","page":"Home","title":"Home","text":"using JSServe: onjs, evaljs, on_document_load\n\napp = App() do session::Session\n    s1 = Slider(1:100)\n    slider_val = DOM.p(s1[]) # initialize with current value\n\n    fig, ax, splot = scatter(1:4)\n\n    # With on_document_load one can run JS after everything got loaded.\n    # This is an alternative to `evaljs`, which we can't use here,\n    # since it gets run asap, which means the plots won't be found yet.\n\n    on_document_load(session, js\"\"\"\n        const plots = $(splot)\n        const scatter_plot = plots[0]\n        // open the console with ctr+shift+i, to inspect the values\n        // tip - you can right click on the log and store the actual variable as a global, and directly interact with it to change the plot.\n        console.log(scatter_plot)\n        console.log(scatter_plot.material.uniforms)\n        console.log(scatter_plot.geometry.attributes)\n    \"\"\")\n\n    # with the above, we can find out that the positions are stored in `offset`\n    # (*sigh*, this is because threejs special cases `position` attributes so it can't be used)\n    # Now, lets go and change them when using the slider :)\n    onjs(session, s1.value, js\"\"\"function on_update(new_value) {\n        const plots = $(splot)\n        const scatter_plot = plots[0]\n\n        // change first point x + y value\n        scatter_plot.geometry.attributes.offset.array[0] = (new_value/100) * 4\n        scatter_plot.geometry.attributes.offset.array[1] = (new_value/100) * 4\n        // this always needs to be set of geometry attributes after an update\n        scatter_plot.geometry.attributes.offset.needsUpdate = true\n    }\n    \"\"\")\n    # and for got measures, add a slider to change the color:\n    color_slider = Slider(LinRange(0, 1, 100))\n    onjs(session, color_slider.value, js\"\"\"function on_update(hue) {\n        const plot = $(splot)[0]\n        const color = new THREE.Color()\n        color.setHSL(hue, 1.0, 0.5)\n        plot.material.uniforms.color.value.x = color.r\n        plot.material.uniforms.color.value.y = color.g\n        plot.material.uniforms.color.value.z = color.b\n    }\"\"\")\n\n    markersize = Slider(1:100)\n    onjs(session, markersize.value, js\"\"\"function on_update(size) {\n        const plot = $(splot)[0]\n        plot.material.uniforms.markersize.value.x = size\n        plot.material.uniforms.markersize.value.y = size\n    }\"\"\")\n    return DOM.div(s1, color_slider, markersize, fig)\nend","category":"page"},{"location":"","page":"Home","title":"Home","text":"This summarizes the current state of interactivity with WGLMakie inside static pages.","category":"page"},{"location":"","page":"Home","title":"Home","text":"Note that the normal interactivity from Makie is preserved with WGLMakie in e.g. Pluto, as long as the Julia session is running. Which brings us to setting up Pluto/IJulia sessions! The return value of your first cell must be the return value of the function Page.  For example, your first cell can be","category":"page"},{"location":"","page":"Home","title":"Home","text":"begin\n\tusing JSServe\n\tPage()\nend","category":"page"},{"location":"","page":"Home","title":"Home","text":"As is common with files meant to be shared, you might wish to set up a temporary directory so as to not pollute other people's environment. The following code will also be a valid first cell.","category":"page"},{"location":"","page":"Home","title":"Home","text":"begin\n\tusing Pkg\n\tPkg.activate(mktempdir())\n\t\n\tPkg.add(\"JSServe\")\n\tusing JSServe\n\tPage()\nend","category":"page"},{"location":"","page":"Home","title":"Home","text":"If you're accessing the notebook from another PC, you must set:","category":"page"},{"location":"","page":"Home","title":"Home","text":"begin\n\tusing JSServe\n\tPage(listen_url=\"0.0.0.0\")\nend","category":"page"},{"location":"","page":"Home","title":"Home","text":"For more advanced setups consult the ?Page docs and JSServe.configure_server!.","category":"page"},{"location":"#Styling","page":"Home","title":"Styling","text":"","category":"section"},{"location":"","page":"Home","title":"Home","text":"You may have noticed, styling isn't really amazing right now. The good news is, that one can use the whole mighty power of the CSS/HTML universe. If it wasn't clear so far, JSServe allows to load arbitrary css, and DOM.xxx wraps all existing HTML tags.","category":"page"},{"location":"","page":"Home","title":"Home","text":"using Colors\nusing JSServe: rows\n\nApp() do session::Session\n\n    hue_slider = Slider(0:360)\n    color_swatch = DOM.div(class=\"h-6 w-6 p-2 m-2 rounded shadow\")\n\n    onjs(session, hue_slider.value, js\"\"\"function (hue){\n        $(color_swatch).style.backgroundColor = \"hsl(\" + hue + \",60%,50%)\"\n    }\"\"\")\n\n    return DOM.div(JSServe.TailwindCSS, rows(hue_slider, color_swatch))\nend","category":"page"},{"location":"","page":"Home","title":"Home","text":"Tailwind is quite a amazing and has a great documentation especially for CSS beginners: https://tailwindcss.com/docs/","category":"page"},{"location":"","page":"Home","title":"Home","text":"Note, that JSServe.TailwindCSS is nothing but:","category":"page"},{"location":"","page":"Home","title":"Home","text":"TailwindCSS = JSServe.Asset(\"/path/to/tailwind.min.css\")","category":"page"},{"location":"","page":"Home","title":"Home","text":"So any other CSS file can be used.","category":"page"},{"location":"","page":"Home","title":"Home","text":"It's also pretty easy to make reusable blocks from styled elements. E.g. the rows function above is nothing but:","category":"page"},{"location":"","page":"Home","title":"Home","text":"rows(args...; class=\"\") = DOM.div(args..., class=class * \" flex flex-row\")","category":"page"},{"location":"","page":"Home","title":"Home","text":"It would be more correct to define it as:","category":"page"},{"location":"","page":"Home","title":"Home","text":"rows(args...; class=\"\") = DOM.div(JSServe.TailwindCSS, args..., class=class * \" flex flex-row\")","category":"page"},{"location":"","page":"Home","title":"Home","text":"JSServe will then make sure, that JSServe.TailwindCSS is loaded, and will only load it once!","category":"page"},{"location":"","page":"Home","title":"Home","text":"Finally, lets create a styled, reusable card componenent:","category":"page"},{"location":"","page":"Home","title":"Home","text":"using Markdown\n\nstruct GridCard\n    elements::Any\nend\n\nGridCard(elements...) = GridCard(elements)\n\nfunction JSServe.jsrender(card::GridCard)\n    return DOM.div(JSServe.TailwindCSS, card.elements..., class=\"rounded-lg p-2 m-2 shadow-lg grid auto-cols-max grid-cols-2 gap-4\")\nend\n\nApp() do session::Session\n    # We can now use this wherever we want:\n    fig = Figure(resolution=(200, 200))\n    contour(fig[1,1], rand(4,4))\n    card = GridCard(\n        Slider(1:100),\n        DOM.h1(\"hello\"),\n        DOM.img(src=\"https://julialang.org/assets/infra/logo.svg\"),\n        fig\n    )\n    # Markdown creates a DOM as well, and you can interpolate\n    # arbitrary jsrender'able elements in there:\n    return md\"\"\"\n\n    # Wow, Markdown works as well?\n\n    $(card)\n\n    \"\"\"\nend","category":"page"},{"location":"","page":"Home","title":"Home","text":"Hopefully, over time there will be helper libraries with lots of stylised elements like the above, to make flashy dashboards with JSServe + WGLMakie.","category":"page"},{"location":"#Troubleshooting","page":"Home","title":"Troubleshooting","text":"","category":"section"},{"location":"#Plots-don't-display-in-Safari","page":"Home","title":"Plots don't display in Safari","text":"","category":"section"},{"location":"","page":"Home","title":"Home","text":"Safari users may need to enable WebGL.","category":"page"}]
}
