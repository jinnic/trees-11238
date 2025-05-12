<script>
  import { onMount } from "svelte";
  import * as d3 from "d3";

  // Props
  export let data = [];
  export let width = 800;
  export let height = 600;
  export let margin = { top: 20, right: 20, bottom: 20, left: 20 };
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
    calculateCirclePack();
  }

  function calculateCirclePack() {
    if (!data || data.length === 0) return;

    // Edge buffer to prevent boundary overlapping
    const edgeBuffer = 15;
    const effectiveVisWidth = visWidth - 2 * edgeBuffer;
    const effectiveVisHeight = visHeight - 2 * edgeBuffer;
    const effectiveArea = effectiveVisWidth * effectiveVisHeight;

    // Define boundaries for collision detection
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

    // Create a grid layout for initial positions
    const columns = Math.ceil(
      Math.sqrt((circleCount * effectiveVisWidth) / effectiveVisHeight)
    );
    const rows = Math.ceil(circleCount / columns);
    const gridWidth = effectiveVisWidth / columns;
    const gridHeight = effectiveVisHeight / rows;

    // Assign initial positions
    const nodesWithPositions = processedData.map((d, i) => {
      // Calculate grid position
      const col = i % columns;
      const row = Math.floor(i / columns);

      // Add jitter to prevent perfect grid alignment
      const jitterX = (Math.random() - 0.5) * gridWidth * 0.5;
      const jitterY = (Math.random() - 0.5) * gridHeight * 0.5;

      return {
        ...d,
        // Initial position based on grid with jitter
        x: margin.left + edgeBuffer + col * gridWidth + gridWidth / 2 + jitterX,
        y:
          margin.top + edgeBuffer + row * gridHeight + gridHeight / 2 + jitterY,
      };
    });

    // Create and configure force simulation
    const simulation = d3
      .forceSimulation(nodesWithPositions)
      // Weak charge force to slightly repel circles
      .force("charge", d3.forceManyBody().strength(-0.3))
      // Strong collision detection to prevent overlaps
      .force(
        "collide",
        d3
          .forceCollide((d) => d.radius + 0.5)
          .strength(1)
          .iterations(6)
      )
      // Individual target forces with minimal jitter to maintain grid-like structure
      .force(
        "x",
        d3.forceX((d) => d.x + (Math.random() - 0.5) * 10).strength(0.04)
      )
      .force(
        "y",
        d3.forceY((d) => d.y + (Math.random() - 0.5) * 10).strength(0.04)
      )
      // Simulation parameters
      .alpha(1)
      .alphaDecay(0.01)
      .stop();

    // Run simulation steps
    for (let i = 0; i < 300; i++) {
      // Run one step of the simulation
      simulation.tick();

      // Boundary enforcement: keep circles within boundaries
      nodesWithPositions.forEach((node) => {
        // Left boundary
        if (node.x - node.radius < boundaryLeft) {
          node.x = boundaryLeft + node.radius + Math.random() * 2;
          node.vx = Math.abs(node.vx || 0) * 0.2; // Bounce effect
        }
        // Right boundary
        if (node.x + node.radius > boundaryRight) {
          node.x = boundaryRight - node.radius - Math.random() * 2;
          node.vx = -Math.abs(node.vx || 0) * 0.2; // Bounce effect
        }
        // Top boundary
        if (node.y - node.radius < boundaryTop) {
          node.y = boundaryTop + node.radius + Math.random() * 2;
          node.vy = Math.abs(node.vy || 0) * 0.2; // Bounce effect
        }
        // Bottom boundary
        if (node.y + node.radius > boundaryBottom) {
          node.y = boundaryBottom - node.radius - Math.random() * 2;
          node.vy = -Math.abs(node.vy || 0) * 0.2; // Bounce effect
        }
      });

      // Advanced overlap detection and resolution in later iterations
      if (i > 200) {
        // Use quadtree for efficient spatial partitioning and neighbor finding
        const q = d3
          .quadtree()
          .x((d) => d.x)
          .y((d) => d.y)
          .addAll(nodesWithPositions);

        // Check each node against potentially overlapping neighbors
        nodesWithPositions.forEach((node) => {
          q.visit((quad, x1, y1, x2, y2) => {
            if (!quad.length) {
              do {
                if (quad.data !== node) {
                  const x = node.x - quad.data.x;
                  const y = node.y - quad.data.y;
                  const l = Math.sqrt(x * x + y * y);
                  const r = node.radius + quad.data.radius;

                  // If overlapping, separate them
                  if (l < r) {
                    const d = ((l - r) / l) * 0.5;
                    const dx = x * d;
                    const dy = y * d;

                    // Move both circles away from each other
                    node.x -= dx;
                    node.y -= dy;
                    quad.data.x += dx;
                    quad.data.y += dy;

                    // Re-check boundaries after adjustment
                    [node, quad.data].forEach((n) => {
                      if (n.x - n.radius < boundaryLeft)
                        n.x = boundaryLeft + n.radius;
                      if (n.x + n.radius > boundaryRight)
                        n.x = boundaryRight - n.radius;
                      if (n.y - n.radius < boundaryTop)
                        n.y = boundaryTop + n.radius;
                      if (n.y + n.radius > boundaryBottom)
                        n.y = boundaryBottom - n.radius;
                    });
                  }
                }
              } while ((quad = quad.next));
            }

            // Return true if there's no need to visit this quad
            return (
              x1 > node.x + node.radius ||
              x2 < node.x - node.radius ||
              y1 > node.y + node.radius ||
              y2 < node.y - node.radius
            );
          });
        });
      }
    }

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
