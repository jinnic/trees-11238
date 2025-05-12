<script>
  import { onMount } from "svelte";
  import * as d3 from "d3";

  // Props
  export let data = [];
  export let width = 800;
  export let height = 600;
  export let margin = { top: 20, right: 20, bottom: 20, left: 20 };
  export let latAccessor = (d) => d.latitude;
  export let lngAccessor = (d) => d.longitude;
  export let colorAccessor = (d) => d.genus_name;
  export let radiusAccessor = null;
  export let tooltipAccessor = null;
  export let highlightCondition = null; // Optional condition to highlight specific circles

  // Internal state
  let svgElement;
  let nodes = [];

  // Derived values
  $: visWidth = width - margin.left - margin.right;
  $: visHeight = height - margin.top - margin.bottom;
  $: effectiveArea = visWidth * visHeight;

  // Color scale based on genus
  $: colorScale = d3
    .scaleOrdinal(d3.schemeCategory10)
    .domain([...new Set(data.map(colorAccessor))]);

  // Process data and layout whenever props change
  $: if (data && data.length > 0 && width && height) {
    calculateMappedPositions();
  }

  function calculateMappedPositions() {
    if (!data || data.length === 0) return;

    // Edge buffer to prevent boundary overlapping
    const edgeBuffer = 15;
    const effectiveVisWidth = visWidth - 2 * edgeBuffer;
    const effectiveVisHeight = visHeight - 2 * edgeBuffer;
    const effectiveArea = effectiveVisWidth * effectiveVisHeight;

    // Define boundaries
    const boundaryLeft = margin.left + edgeBuffer;
    const boundaryRight = margin.left + visWidth - edgeBuffer;
    const boundaryTop = margin.top + edgeBuffer;
    const boundaryBottom = margin.top + visHeight - edgeBuffer;

    // Number of data points
    const circleCount = data.length;

    // Area adjuster controls overall circle density
    const AREA_ADJUSTER = 0.075;

    // Calculate radius for each data point if not provided
    const processedData = data.map((d, i) => {
      let radius;

      if (radiusAccessor) {
        radius = radiusAccessor(d);
      } else {
        // Default radius calculation based on tree_dbh
        const dbhExtent = d3.extent(data, (d) => +d.tree_dbh || 1);
        const scalingFactor = (1 / circleCount) * effectiveArea * AREA_ADJUSTER;
        const normalizedDbh =
          1 +
          (9 * ((+d.tree_dbh || 1) - dbhExtent[0])) /
            (dbhExtent[1] - dbhExtent[0] || 1);
        radius = Math.sqrt(normalizedDbh * scalingFactor);
      }

      return {
        ...d,
        id: d.id || `${d.genus_name}_${i}`,
        radius: radius,
      };
    });

    // Calculate scales for mapping latitude/longitude to screen coordinates
    const latExtent = d3.extent(processedData, latAccessor);
    const lngExtent = d3.extent(processedData, lngAccessor);

    // Create scales with padding to prevent circles at edges
    const xScale = d3
      .scaleLinear()
      .domain(lngExtent)
      .range([boundaryLeft, boundaryRight]);

    const yScale = d3
      .scaleLinear()
      .domain(latExtent)
      .range([boundaryBottom, boundaryTop]); // Reversed because lat increases northward

    // Map coordinates to screen positions
    const positionedNodes = processedData.map((d) => {
      const x = xScale(lngAccessor(d));
      const y = yScale(latAccessor(d));

      // Check for invalid coordinates
      if (isNaN(x) || isNaN(y)) {
        console.warn("Invalid coordinates for node:", d);
        // Fallback to center position
        return {
          ...d,
          x: margin.left + visWidth / 2,
          y: margin.top + visHeight / 2,
        };
      }

      return {
        ...d,
        x: x,
        y: y,
      };
    });

    nodes = positionedNodes;
  }
</script>

<svg bind:this={svgElement} {width} {height}>
  {#each nodes as node}
    <circle
      cx={node.x}
      cy={node.y}
      r={node.radius}
      fill={highlightCondition
        ? highlightCondition(node)
          ? colorScale(colorAccessor(node))
          : "#ccc"
        : colorScale(colorAccessor(node))}
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
</style>
