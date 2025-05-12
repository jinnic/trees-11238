<script>
  import { onMount } from "svelte";
  import * as d3 from "d3";

  export let data = [];
  export let width = 800;
  export let height = 600;

  // Configurable options
  export let margin = { top: 20, right: 30, bottom: 40, left: 50 };
  export let valueAccessor = (d) => +d.tree_dbh || 1;
  export let colorAccessor = (d) => d.genus_name;
  export let radiusAccessor = (d) => d.radius;
  export let tooltipAccessor = null;

  let svgElement;
  let nodes = [];

  $: visWidth = width - margin.left - margin.right;
  $: visHeight = height - margin.top - margin.bottom;

  $: if (data && data.length > 0 && width && height) {
    calculateBeeswarmLayout();
  }

  // Color scale based on genus
  $: colorScale = d3
    .scaleOrdinal(d3.schemeCategory10)
    .domain([...new Set(data.map(colorAccessor))]);

  function calculateBeeswarmLayout() {
    // X scale based on tree diameter
    const xValues = data.map(valueAccessor);
    const xScale = d3
      .scaleLinear()
      .domain([0, d3.max(xValues) * 1.05])
      .range([margin.left, margin.left + visWidth]);

    // Initialize simulation
    const simulation = d3
      .forceSimulation(data)
      // Position nodes along x-axis based on tree_dbh
      .force("x", d3.forceX((d) => xScale(valueAccessor(d))).strength(0.95))
      // Center nodes vertically
      .force("y", d3.forceY(margin.top + visHeight / 2).strength(0.1))
      // Prevent node overlap
      .force(
        "collision",
        d3
          .forceCollide((d) => radiusAccessor(d) + 1)
          .strength(0.9)
          .iterations(4)
      )
      .stop();

    // Run simulation
    for (let i = 0; i < 120; ++i) simulation.tick();

    // Extract positions and constrain to boundaries
    nodes = data.map((d) => {
      // Ensure nodes stay within vertical boundaries
      const y = Math.max(
        margin.top + radiusAccessor(d),
        Math.min(margin.top + visHeight - radiusAccessor(d), d.y)
      );

      // Validate positions to prevent NaN
      if (isNaN(d.x) || isNaN(y)) {
        console.warn("Invalid position detected for node:", d);
        // Provide fallback position
        return {
          ...d,
          beeswarm_x: margin.left + visWidth / 2,
          beeswarm_y: margin.top + visHeight / 2,
        };
      }

      return {
        ...d,
        beeswarm_x: d.x,
        beeswarm_y: y,
      };
    });
  }
</script>

<svg bind:this={svgElement} {width} {height}>
  <!-- X axis -->
  <g transform={`translate(0,${margin.top + visHeight})`}>
    {#if data.length > 0}
      {#each d3
        .scaleLinear()
        .domain([0, d3.max(data.map(valueAccessor)) * 1.05])
        .range([margin.left, margin.left + visWidth])
        .ticks(8) as tick}
        <line
          x1={tick === 0 ? margin.left : tick}
          y1={-5}
          x2={tick === 0 ? margin.left : tick}
          y2={5}
          stroke="black"
        />
        <text
          x={tick === 0 ? margin.left : tick}
          y={20}
          text-anchor="middle"
          font-size="12px"
        >
          {tick}
        </text>
      {/each}
      <text
        x={margin.left + visWidth / 2}
        y={35}
        text-anchor="middle"
        font-size="14px"
      >
        Tree Diameter (inches)
      </text>
    {/if}
  </g>

  <!-- Circles -->
  {#each nodes as node}
    <circle
      cx={node.beeswarm_x}
      cy={node.beeswarm_y}
      r={radiusAccessor(node)}
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
      r 0.8s ease;
  }
</style>
