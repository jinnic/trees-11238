<script>
  import { onMount } from "svelte";
  import * as d3 from "d3";

  // Props
  export let data = [];
  export let width = 800;
  export let height = 600;
  export let margin = { top: 20, right: 30, bottom: 100, left: 50 };
  export let colorAccessor = (d) => d.genus_name;
  export let radiusAccessor = null;
  export let tooltipAccessor = null;

  // Internal state
  let svgElement;
  let nodes = [];
  let genusLabels = [];

  // Derived values
  $: visWidth = width - margin.left - margin.right;
  $: visHeight = height - margin.top - margin.bottom;

  // Color scale based on genus
  $: colorScale = d3
    .scaleOrdinal(d3.schemeCategory10)
    .domain([...new Set(data.map(colorAccessor))]);

  // Process data and layout whenever props change
  $: if (data && data.length > 0 && width && height) {
    calculateBeeswarmByGenus();
  }

  function calculateBeeswarmByGenus() {
    if (!data || data.length === 0) return;

    // Group data by genus
    const genusGroups = d3.group(data, colorAccessor);

    // Sort genera by name
    const sortedGenera = Array.from(genusGroups.keys()).sort();

    // Create x scale for genera positioning
    const xScale = d3
      .scaleBand()
      .domain(sortedGenera)
      .range([margin.left, margin.left + visWidth])
      .padding(0.2);

    const bandWidth = xScale.bandwidth();

    // Calculate radius for each data point if not provided
    const processedData = data.map((d, i) => {
      let radius;

      if (radiusAccessor) {
        radius = radiusAccessor(d);
      } else {
        // Default radius calculation based on tree_dbh
        const dbhExtent = d3.extent(data, (d) => +d.tree_dbh || 1);
        const normalizedDbh =
          1 +
          (9 * ((+d.tree_dbh || 1) - dbhExtent[0])) /
            (dbhExtent[1] - dbhExtent[0] || 1);

        // Adjust radius based on band width to ensure circles fit
        const maxRadius = Math.min(bandWidth / 5, 20);
        radius = Math.sqrt(normalizedDbh) * (maxRadius / Math.sqrt(10));
      }

      return {
        ...d,
        id: d.id || `${d.genus_name}_${i}`,
        radius: radius,
        genus: colorAccessor(d),
      };
    });

    // Create simulations for each genus
    const nodesWithPositions = [];

    sortedGenera.forEach((genus) => {
      const genusData = processedData.filter((d) => colorAccessor(d) === genus);
      const centerX = xScale(genus) + bandWidth / 2;

      // Initialize positions vertically stacked
      const initializedData = genusData.map((d, i) => ({
        ...d,
        x: centerX + (Math.random() - 0.5) * 5, // Small jitter
        y: margin.top + 50 + i * 5, // Stack initially
      }));

      // Create force simulation for this genus
      const simulation = d3
        .forceSimulation(initializedData)
        // Keep x position fixed at the genus center
        .force("x", d3.forceX(centerX).strength(0.8))
        // Spread nodes vertically
        .force("y", d3.forceY((d) => margin.top + visHeight / 2).strength(0.05))
        // Prevent node overlap
        .force(
          "collision",
          d3
            .forceCollide((d) => d.radius + 1)
            .strength(0.7)
            .iterations(4)
        )
        .stop();

      // Run simulation
      for (let i = 0; i < 120; ++i) simulation.tick();

      // Constrain to boundaries
      initializedData.forEach((d) => {
        // Keep within horizontal band
        d.x = Math.max(
          xScale(genus) + d.radius,
          Math.min(xScale(genus) + bandWidth - d.radius, d.x)
        );

        // Keep within vertical bounds
        d.y = Math.max(
          margin.top + d.radius,
          Math.min(margin.top + visHeight - d.radius, d.y)
        );
      });

      // Add to final nodes array
      nodesWithPositions.push(...initializedData);
    });

    // Create genus labels
    genusLabels = sortedGenera.map((genus) => ({
      genus,
      x: xScale(genus) + bandWidth / 2,
      y: margin.top + visHeight + 20,
    }));

    // Save the final positions
    nodes = nodesWithPositions.map((node) => {
      // Validate positions to prevent NaN values
      if (isNaN(node.x) || isNaN(node.y)) {
        console.warn("Invalid position detected for node:", node);
        // Provide fallback position in the center of the visualization
        return {
          ...node,
          x: margin.left + visWidth / 2,
          y: margin.top + visHeight / 2,
        };
      }
      return node;
    });
  }
</script>

<svg bind:this={svgElement} {width} {height}>
  <!-- Genus labels -->
  {#each genusLabels as label}
    <text
      x={label.x}
      y={label.y}
      text-anchor="middle"
      font-size="12px"
      transform={`rotate(45, ${label.x}, ${label.y})`}
    >
      {label.genus}
    </text>
  {/each}

  <!-- Circles -->
  {#each nodes as node}
    <circle
      cx={node.x}
      cy={node.y}
      r={node.radius}
      fill={colorScale(colorAccessor(node))}
      stroke="#fff"
      stroke-width="1"
      opacity="0.9"
    >
      {#if tooltipAccessor}
        <title>{tooltipAccessor(node)}</title>
      {/if}
    </circle>
  {/each}
</svg>

<style>
  svg {
    display: block;
  }

  circle {
    transition:
      cx 0.8s ease,
      cy 0.8s ease,
      r 0.8s ease,
      fill 0.8s ease;
  }

  text {
    font-family: sans-serif;
  }
</style>
