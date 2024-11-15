function simulate(data, svg) {
    const width = parseInt(svg.attr("viewBox").split(' ')[2]);
    const height = parseInt(svg.attr("viewBox").split(' ')[3]);
    const main_group = svg.append("g").attr("transform", "translate(0, 50)");

    // Calculate node degrees
    let node_degree = {};
    d3.map(data.links, function (d) {
        if (node_degree.hasOwnProperty(d.source)) {
            node_degree[d.source]++;
        } else {
            node_degree[d.source] = 0;
        }
        if (node_degree.hasOwnProperty(d.target)) {
            node_degree[d.target]++;
        } else {
            node_degree[d.target] = 0;
        }
    });

    // Define radius scale based on node degree
    const scale_radius = d3.scaleSqrt()
        .domain(d3.extent(Object.values(node_degree)))
        .range([3, 12]);

    // Calculate country counts
    const countryCounts = {};
    data.nodes.forEach(node => {
        const countries = node["Affiliation Countries"];
        if (countries) {
            countries.forEach(country => {
                if (country in countryCounts) {
                    countryCounts[country]++;
                } else {
                    countryCounts[country] = 1;
                }
            });
        }
    });

    // Get top 10 countries
    const topCountries = Object.entries(countryCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(entry => entry[0]);

    // Color scale for countries
    const colorScale = d3.scaleOrdinal(d3.schemeCategory10)
     .domain(topCountries);



    // Get color by country
    const getColorByCountry = (countries) => {
        if (countries) {
            let maxCount = -1;
            let selectedCountry = null;
            for (const country of countries) {
                const index = topCountries.indexOf(country);
                if (index !== -1 && countryCounts[country] > maxCount) {
                    maxCount = countryCounts[country];
                    selectedCountry = country;
                }
            }
            if (selectedCountry !== null) {
                return colorScale(topCountries.indexOf(selectedCountry));
            }
        }
        return "#A9A9A9";
    };

    // Append link elements
    const link_elements = main_group.append("g")
        .attr('transform', `translate(${width / 2},${height / 2})`)
        .selectAll(".line")
        .data(data.links)
        .enter()
        .append("line")
        .attr("stroke", "black");

    // Clean Publisher string for class names
    const treatPublishersClass = (Publisher) => {
        let temp = Publisher.toString().split(' ').join('');
        temp = temp.split('.').join('');
        temp = temp.split(',').join('');
        temp = temp.split('/').join('');
        return "gr" + temp;
    };

    // Append node elements
    const node_elements = main_group.append("g")
        .attr('transform', `translate(${width / 2},${height / 2})`)
        .selectAll(".circle")
        .data(data.nodes)
        .enter()
        .append('g')
        .attr("class", function (d) { return treatPublishersClass(d.Publisher) })
        .on("mouseover", function (event, data) {
            const affiliations = data["Affiliation"];
            node_elements.selectAll("circle")
                .style("opacity", function (d) {
                    if (d["Affiliation"]) {
                        for (const affiliation of affiliations) {
                            if (d["Affiliation"].includes(affiliation)) {
                                return 1;
                            }
                        }
                    }
                    return 0.2;
                });
        })
        .on("mouseout", function () {
            node_elements.selectAll("circle").style("opacity", 1);
        })
        .on("click", function (event, data) {
            const tooltip = d3.select(".tooltip");
            tooltip.transition().duration(200).style("opacity", .9);
            tooltip.html(`Author: ${data.Authors}<br>Affiliation: ${data.Affiliation.join(", ")}`)
                .style("left", (event.pageX + 5) + "px")
                .style("top", (event.pageY - 28) + "px");

            tooltip.transition()
                .delay(10000) // Hide tooltip after 10 seconds
                .duration(200)
                .style("opacity", 0);
        });

    // Append circles for nodes
    node_elements.append("circle")
        .attr("r", (d, i) => {
            if (node_degree[d.id] !== undefined) {
                return scale_radius(node_degree[d.id]);
            } else {
                return scale_radius(0);
            }
        })
        .attr("fill", d => getColorByCountry(d["Affiliation Countries"]));

    // Force Simulation
    let ForceSimulation = d3.forceSimulation(data.nodes)
        .force("collide", d3.forceCollide().radius(d => scale_radius(node_degree[d.id]) * 1.2))
        .force("x", d3.forceX())
        .force("y", d3.forceY())
        .force("charge", d3.forceManyBody().strength(-50))
        .force("link", d3.forceLink(data.links).id(d => d.id).strength(0.5))
        .on("tick", ticked);

    // Update forces when sliders change
    function updateForces() {
        const chargeStrength = parseInt(document.getElementById("chargeStrength").value);
        const collisionRadius = parseInt(document.getElementById("collisionRadius").value);
        const linkStrength = parseFloat(document.getElementById("linkStrength").value);

        ForceSimulation
            .force("charge", d3.forceManyBody().strength(chargeStrength))
            .force("collide", d3.forceCollide().radius(d => scale_radius(node_degree[d.id]) * collisionRadius / 12))
            .force("link", d3.forceLink(data.links).id(d => d.id).strength(linkStrength))
            .alpha(1) // Restart simulation immediately
            .restart();
    }

    // Add event listeners for sliders
    document.getElementById("chargeStrength").addEventListener("input", updateForces);
    document.getElementById("collisionRadius").addEventListener("input", updateForces);
    document.getElementById("linkStrength").addEventListener("input", updateForces);

    // Update node and link positions on each tick
    function ticked() {
        node_elements.attr('transform', function (d) { return `translate(${d.x},${d.y})` });
        link_elements
            .attr("x1", d => d.source.x)
            .attr("x2", d => d.target.x)
            .attr("y1", d => d.source.y)
            .attr("y2", d => d.target.y);
    }

    // Zoom functionality
    svg.call(d3.zoom()
        .extent([[0, 0], [width, height]])
        .scaleExtent([1, 8])
        .on("zoom", ({ transform }) => main_group.attr("transform", transform)));
}
