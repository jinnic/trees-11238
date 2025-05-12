<script>
  import { onMount, afterUpdate } from "svelte";
  import * as d3 from "d3";
  import { fade } from "svelte/transition";
  import data from "$data/tree_census_pollen_genus.json";
  import {
    hoveredNode,
    highlightedNodes,
    selectedGenera,
  } from "./stores/filterStore";

  // Import components
  import Tooltip from "./components/Tooltip.svelte";
  import FilterLegend from "./components/FilterLegend.svelte";
  import ColorLegend from "./components/ColorLegend.svelte";

  // Container for the visualizations
  let container;
  let navContainer;
  let navHeight = 0;
  let clientWidth = 0;
  let windowHeight = 0;
  let effectiveHeight = 0;
  let nodes = []; // Will hold the data with all position sets
  let sortedGenera = []; // Store sorted genera (by count) for step 5

  // Linear story state
  let storyStep = 1;
  const TOTAL_STEPS = 6;

  // Validate and clean the data
  const validatedData = data.filter((item) => {
    // Check for required properties
    const hasRequiredProps =
      item.genus_name &&
      !isNaN(Number(item.tree_dbh || 0)) &&
      !isNaN(Number(item.latitude || 0)) &&
      !isNaN(Number(item.longitude || 0));

    if (!hasRequiredProps) {
      console.warn("Invalid data item found:", item);
    }

    return hasRequiredProps;
  });

  // Get all unique genera
  const genera =
    validatedData && validatedData.length > 0
      ? [...new Set(validatedData.map((d) => d.genus_name))].sort()
      : [];

  // Story step descriptions
  const storySteps = [
    "Trees that are alive in my zipcode",
    "All the trees in my zipcode",
    "Tree with pollen allergy or not",
    "Compare tree diameters from smallest to largest",
    "Variety and distribution of tree species",
    "Track tree pollen activity throughout the year",
  ];

  // Configurable margins
  const margin = {
    top: 20,
    right: 20,
    bottom: 20,
    left: 20,
  };

  // Calculate effective height (subtract navigation container height and add margins)
  $: {
    // Calculate available height for visualization
    effectiveHeight =
      windowHeight - navHeight - margin.top - margin.bottom - 100; // Extra for h1 and page padding

    // Ensure minimum height
    if (effectiveHeight < 400) {
      effectiveHeight = 400;
    }
  }

  // Navigation functions
  function nextStep() {
    if (storyStep < TOTAL_STEPS) {
      storyStep++;
    }
  }

  function prevStep() {
    if (storyStep > 1) {
      storyStep--;
    }
  }

  // Check if tree is allergenic
  function isAllergenic(node) {
    // Allergenicity: 0 = none, 1 = normal, 2 = severe
    return node.Allergenicity && node.Allergenicity > 0;
  }

  // Tooltip accessor function
  function getTooltip(node) {
    return `${node.spc_common || node.genus_name}
Genus: ${node.genus_name}
DBH: ${node.tree_dbh || "Unknown"} inches
Allergenicity: ${node.Allergenicity || "Unknown"}`;
  }

  // Handle hover events
  function handleMouseOver(node, event) {
    if (storyStep === 5) {
      // For step 5, show genus statistics instead of individual tree info
      const genusName = node.genus_name;
      const genusNodes = nodes.filter((n) => n.genus_name === genusName);
      const count = genusNodes.length;
      const percentage = ((count / nodes.length) * 100).toFixed(1);

      $hoveredNode = {
        ...node,
        x: event.clientX,
        y: event.clientY,
        isGenusInfo: true,
        genusCount: count,
        genusPercentage: percentage,
      };
    } else {
      // For other steps, show individual tree info
      $hoveredNode = {
        ...node,
        x: event.clientX,
        y: event.clientY,
      };
    }
  }

  function handleMouseOut() {
    $hoveredNode = null;
  }

  // Handle click to toggle genus filter
  function handleCircleClick(node) {
    if (!node.genus_name) return;

    // Toggle the genus in the filter
    if ($selectedGenera.includes(node.genus_name)) {
      $selectedGenera = $selectedGenera.filter((g) => g !== node.genus_name);
    } else {
      $selectedGenera = [...$selectedGenera, node.genus_name];
    }
  }

  // Calculate all positions when dimensions change
  $: if (clientWidth && effectiveHeight > 0) {
    calculateAllPositions();
  }

  // Create a better color scale for many categories using interpolation
  // This generates a wider range of distinct colors than standard d3 categorical schemes
  const colorScale = d3
    .scaleOrdinal()
    .domain(genera)
    .range(
      d3.quantize(
        d3.interpolateRainbow,
        genera.length > 10 ? genera.length : 10
      )
    );

  // Calculate positions for all visualization types
  function calculateAllPositions() {
    if (!validatedData || validatedData.length === 0) return;

    // Calculate available space for visualization
    const visWidth = clientWidth - margin.left - margin.right;
    const visHeight = effectiveHeight - margin.top - margin.bottom;

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

    // Calculate radius for all data points
    const circleCount = validatedData.length;
    const AREA_ADJUSTER = 0.075;
    const dbhExtent = d3.extent(validatedData, (d) => +d.tree_dbh || 1);
    const scalingFactor = (1 / circleCount) * effectiveArea * AREA_ADJUSTER;

    // Initialize nodes with basic information and radius
    nodes = validatedData.map((d, i) => {
      const normalizedDbh =
        1 +
        (9 * ((+d.tree_dbh || 1) - dbhExtent[0])) /
          (dbhExtent[1] - dbhExtent[0] || 1);
      const radius = Math.sqrt(normalizedDbh * scalingFactor);

      return {
        ...d,
        id: `node_${i}`,
        radius: radius,
        highlighted: isAllergenic(d),
      };
    });

    // Calculate MAPPED positions
    const latExtent = d3.extent(nodes, (d) => d.latitude);
    const lngExtent = d3.extent(nodes, (d) => d.longitude);
    const xScale = d3
      .scaleLinear()
      .domain(lngExtent)
      .range([boundaryLeft, boundaryRight]);
    const yScale = d3
      .scaleLinear()
      .domain(latExtent)
      .range([boundaryBottom, boundaryTop]); // Reversed because lat increases northward

    // Assign mapped positions
    nodes = nodes.map((d) => ({
      ...d,
      mapped_x: xScale(d.longitude),
      mapped_y: yScale(d.latitude),
    }));

    // Calculate CIRCLE PACK positions
    // Create a grid layout based on the aspect ratio and number of points
    const columns = Math.ceil(
      Math.sqrt((circleCount * effectiveVisWidth) / effectiveVisHeight)
    );
    const rows = Math.ceil(circleCount / columns);
    const gridWidth = effectiveVisWidth / columns;
    const gridHeight = effectiveVisHeight / rows;

    // Initialize positions with grid layout
    nodes = nodes.map((d, i) => {
      const col = i % columns;
      const row = Math.floor(i / columns);
      const jitterX = (Math.random() - 0.5) * gridWidth * 0.5;
      const jitterY = (Math.random() - 0.5) * gridHeight * 0.5;

      return {
        ...d,
        x: margin.left + edgeBuffer + col * gridWidth + gridWidth / 2 + jitterX,
        y:
          margin.top + edgeBuffer + row * gridHeight + gridHeight / 2 + jitterY,
      };
    });

    // Create and run the force simulation
    const simulation = d3
      .forceSimulation(nodes)
      .force("charge", d3.forceManyBody().strength(-0.3))
      .force(
        "collide",
        d3
          .forceCollide((d) => d.radius + 0.5)
          .strength(1)
          .iterations(6)
      )
      .force(
        "x",
        d3.forceX((d) => d.x + (Math.random() - 0.5) * 10).strength(0.04)
      )
      .force(
        "y",
        d3.forceY((d) => d.y + (Math.random() - 0.5) * 10).strength(0.04)
      )
      .alpha(1)
      .alphaDecay(0.01)
      .stop();

    // Run simulation steps
    for (let i = 0; i < 300; i++) {
      simulation.tick();
      // Boundary enforcement
      nodes.forEach((node) => {
        // Left boundary
        if (node.x - node.radius < boundaryLeft) {
          node.x = boundaryLeft + node.radius + Math.random() * 2;
        }
        // Right boundary
        if (node.x + node.radius > boundaryRight) {
          node.x = boundaryRight - node.radius - Math.random() * 2;
        }
        // Top boundary
        if (node.y - node.radius < boundaryTop) {
          node.y = boundaryTop + node.radius + Math.random() * 2;
        }
        // Bottom boundary
        if (node.y + node.radius > boundaryBottom) {
          node.y = boundaryBottom - node.radius - Math.random() * 2;
        }
      });
    }

    // Store circle pack positions
    nodes = nodes.map((d) => ({
      ...d,
      circle_x: d.x,
      circle_y: d.y,
    }));

    // Calculate BEESWARM positions (horizontal by tree diameter)
    const beeswarmXScale = d3
      .scaleLinear()
      .domain([0, d3.max(nodes, (d) => +d.tree_dbh || 0) * 1.05])
      .range([boundaryLeft, boundaryRight]);

    // Create a new simulation for the beeswarm
    const beeswarmSim = d3
      .forceSimulation(nodes)
      .force(
        "x",
        d3.forceX((d) => beeswarmXScale(+d.tree_dbh || 0)).strength(0.95)
      )
      .force("y", d3.forceY(margin.top + visHeight / 2).strength(0.1))
      .force(
        "collide",
        d3
          .forceCollide((d) => d.radius + 1)
          .strength(0.9)
          .iterations(4)
      )
      .stop();

    // Run beeswarm simulation
    for (let i = 0; i < 120; i++) beeswarmSim.tick();

    // Store beeswarm positions
    nodes = nodes.map((d) => ({
      ...d,
      beeswarm_x: d.x,
      beeswarm_y: Math.max(
        boundaryTop + d.radius,
        Math.min(boundaryBottom - d.radius, d.y)
      ),
    }));

    // Calculate GENUS GROUPING positions
    const genusGroups = d3.group(nodes, (d) => d.genus_name);
    // Sort genera by count (descending) instead of alphabetically
    sortedGenera = Array.from(genusGroups.keys()).sort(
      (a, b) => genusGroups.get(b).length - genusGroups.get(a).length
    );

    // Create x scale for genera
    const genusXScale = d3
      .scaleBand()
      .domain(sortedGenera)
      .range([boundaryLeft, boundaryRight])
      .padding(0.2);

    const bandWidth = genusXScale.bandwidth();

    // Process each genus separately
    sortedGenera.forEach((genus) => {
      const genusNodes = nodes.filter((d) => d.genus_name === genus);
      const centerX = genusXScale(genus) + bandWidth / 2;

      // Create simulation for this genus
      const genusSim = d3
        .forceSimulation(genusNodes)
        .force("x", d3.forceX(centerX).strength(0.8))
        .force("y", d3.forceY(margin.top + visHeight / 2).strength(0.05))
        .force(
          "collide",
          d3
            .forceCollide((d) => d.radius + 1)
            .strength(0.7)
            .iterations(4)
        )
        .stop();

      // Run genus simulation
      for (let i = 0; i < 120; i++) genusSim.tick();

      // Store genus positions for these nodes
      genusNodes.forEach((node) => {
        const nodeIndex = nodes.findIndex((n) => n.id === node.id);
        if (nodeIndex >= 0) {
          // Constrain to band
          const x = Math.max(
            genusXScale(genus) + node.radius,
            Math.min(genusXScale(genus) + bandWidth - node.radius, node.x)
          );
          // Constrain to vertical bounds
          const y = Math.max(
            boundaryTop + node.radius,
            Math.min(boundaryBottom - node.radius, node.y)
          );

          nodes[nodeIndex].genus_x = x;
          nodes[nodeIndex].genus_y = y;
        }
      });
    });

    // Store genus labels for rendering
    const genusLabels = sortedGenera.map((genus) => ({
      genus,
      x: genusXScale(genus) + bandWidth / 2,
      y: margin.top + visHeight + 20,
    }));

    // Update current positions based on story step
    updateCurrentPositions();
  }

  // Update positions when story step changes
  $: if (storyStep && nodes.length > 0) {
    updateCurrentPositions();
  }

  function updateCurrentPositions() {
    // Get visualization dimensions
    const visWidth = clientWidth - margin.left - margin.right;
    const visHeight = effectiveHeight - margin.top - margin.bottom;
    const edgeBuffer = 15;
    const effectiveVisWidth = visWidth - 2 * edgeBuffer;
    const effectiveVisHeight = visHeight - 2 * edgeBuffer;

    // For step 3, separate allergenic and non-allergenic trees in a grid
    if (storyStep === 3) {
      // First identify allergenic and non-allergenic nodes
      const allergenicNodes = nodes.filter((node) => node.highlighted);
      const nonAllergenicNodes = nodes.filter((node) => !node.highlighted);

      // Calculate vertical split point
      const splitRatio =
        nonAllergenicNodes.length /
        (nonAllergenicNodes.length + allergenicNodes.length);
      const topHeight = Math.floor(effectiveVisHeight * splitRatio);
      const bottomHeight = effectiveVisHeight - topHeight;

      // 1. Position non-allergenic nodes on top in a grid
      if (nonAllergenicNodes.length > 0) {
        // Calculate grid dimensions for top section
        const topColumns = Math.ceil(
          Math.sqrt((nonAllergenicNodes.length * effectiveVisWidth) / topHeight)
        );
        const topRows = Math.ceil(nonAllergenicNodes.length / topColumns);
        const gridWidth = effectiveVisWidth / topColumns;
        const gridHeight = topHeight / topRows;

        // Position in grid
        nonAllergenicNodes.forEach((node, i) => {
          const col = i % topColumns;
          const row = Math.floor(i / topColumns);

          // Add small jitter for natural look
          const jitterX = (Math.random() - 0.5) * gridWidth * 0.3;
          const jitterY = (Math.random() - 0.5) * gridHeight * 0.3;

          // Calculate position
          const x =
            margin.left +
            edgeBuffer +
            col * gridWidth +
            gridWidth / 2 +
            jitterX;
          const y =
            margin.top +
            edgeBuffer +
            row * gridHeight +
            gridHeight / 2 +
            jitterY;

          // Update in main nodes array
          const idx = nodes.findIndex((n) => n.id === node.id);
          if (idx >= 0) {
            nodes[idx].allergenic_x = x;
            nodes[idx].allergenic_y = y;
          }
        });
      }

      // 2. Position allergenic nodes on bottom in a grid
      if (allergenicNodes.length > 0) {
        // Calculate grid dimensions for bottom section
        const bottomColumns = Math.ceil(
          Math.sqrt((allergenicNodes.length * effectiveVisWidth) / bottomHeight)
        );
        const bottomRows = Math.ceil(allergenicNodes.length / bottomColumns);
        const gridWidth = effectiveVisWidth / bottomColumns;
        const gridHeight = bottomHeight / bottomRows;

        // Position in grid
        allergenicNodes.forEach((node, i) => {
          const col = i % bottomColumns;
          const row = Math.floor(i / bottomColumns);

          // Add small jitter for natural look
          const jitterX = (Math.random() - 0.5) * gridWidth * 0.3;
          const jitterY = (Math.random() - 0.5) * gridHeight * 0.3;

          // Calculate position (add topHeight to y to position at bottom)
          const x =
            margin.left +
            edgeBuffer +
            col * gridWidth +
            gridWidth / 2 +
            jitterX;
          const y =
            margin.top +
            edgeBuffer +
            topHeight +
            row * gridHeight +
            gridHeight / 2 +
            jitterY;

          // Update in main nodes array
          const idx = nodes.findIndex((n) => n.id === node.id);
          if (idx >= 0) {
            nodes[idx].allergenic_x = x;
            nodes[idx].allergenic_y = y;
          }
        });
      }
    }

    // Calculate timeline positions for step 6
    if (storyStep === 6) {
      // Month names starting with Dec
      const months = [
        "Dec",
        "Jan",
        "Feb",
        "Mar",
        "Apr",
        "May",
        "Jun",
        "Jul",
        "Aug",
        "Sep",
        "Oct",
        "Nov",
      ];

      // Define seasons with correct month mapping
      const seasons = [
        { name: "Winter", months: ["Dec", "Jan", "Feb"] },
        { name: "Spring", months: ["Mar", "Apr", "May"] },
        { name: "Summer", months: ["Jun", "Jul", "Aug"] },
        { name: "Fall", months: ["Sep", "Oct", "Nov"] },
      ];

      // Create x scale for months (0-11)
      const monthScale = d3
        .scaleBand()
        .domain(months)
        .range([margin.left, margin.left + visWidth])
        .padding(0.1);

      const bandWidth = monthScale.bandwidth();

      // Create a copy of nodes to avoid modifying the original array
      const timelineNodes = [];

      // Process each node in the nodes array
      nodes.forEach((node) => {
        // Check which months have allergenic values
        months.forEach((month) => {
          // Only create nodes for months with allergenic values (1 or 2)
          if (node[month] > 0) {
            // Calculate the centerX for this month's column
            const centerX = monthScale(month) + bandWidth / 2;

            // Create a node for each allergenic month
            timelineNodes.push({
              ...node,
              month: month,
              allergenicLevel: node[month], // 1 or 2
              timeline_x: centerX + (Math.random() - 0.5) * bandWidth * 0.7, // Add some jitter
              timeline_y:
                margin.top +
                Math.random() * (visHeight - margin.top - margin.bottom), // Random y position
              timeline_month: month,
            });
          }
        });
      });

      // Group by genus and month for better organization
      const groupedByGenusAndMonth = d3.group(
        timelineNodes,
        (d) => d.genus_name,
        (d) => d.month
      );

      // Process each genus group to position nodes within their month columns
      const generaList = [...groupedByGenusAndMonth.keys()].sort();
      const genusColors = {};

      // Calculate genus height bands
      const genusHeight = visHeight / generaList.length;

      // Position nodes by genus and month
      generaList.forEach((genus, genusIndex) => {
        // Store color for this genus
        genusColors[genus] = colorScale(genus);

        // Process all months for this genus
        const genusData = groupedByGenusAndMonth.get(genus);

        // For each month with data for this genus
        for (const [month, monthTrees] of genusData.entries()) {
          // Vertical center for this genus
          const genusCenterY = margin.top + genusHeight * (genusIndex + 0.5);

          // Position trees in a grid around the genus center
          const columns = Math.min(3, monthTrees.length); // Max 3 columns
          const rows = Math.ceil(monthTrees.length / columns);
          const cellWidth = bandWidth / columns;
          const cellHeight = Math.min(genusHeight / rows, 20); // Limit to prevent overlap

          // Position each tree
          monthTrees.forEach((tree, i) => {
            const col = i % columns;
            const row = Math.floor(i / columns);

            // Calculate position
            const jitterX = (Math.random() - 0.5) * cellWidth * 0.3;
            const jitterY = (Math.random() - 0.5) * cellHeight * 0.3;

            // Update tree position
            const idx = timelineNodes.findIndex(
              (n) => n.id === tree.id && n.month === tree.month
            );
            if (idx >= 0) {
              timelineNodes[idx].timeline_x =
                monthScale(month) + cellWidth * (col + 0.5) + jitterX;
              timelineNodes[idx].timeline_y =
                genusCenterY -
                (rows * cellHeight) / 2 +
                row * cellHeight +
                cellHeight / 2 +
                jitterY;
            }
          });
        }
      });

      // Add timeline nodes to main nodes array with special attributes
      timelineNodes.forEach((node) => {
        const idx = nodes.findIndex((n) => n.id === node.id);
        if (idx >= 0) {
          nodes[idx].timeline_x = node.timeline_x;
          nodes[idx].timeline_y = node.timeline_y;
          nodes[idx].timeline_month = node.month;
          nodes[idx].timeline_level = node.allergenicLevel;
        }
      });
    }

    // Update all nodes with the correct positions and colors based on current step
    nodes = nodes.map((node) => {
      let x, y, fill;

      // Set position based on current step
      if (storyStep === 1) {
        // Mapped view
        x = node.mapped_x;
        y = node.mapped_y;
        fill = colorScale(node.genus_name);
      } else if (storyStep === 2) {
        // Circle pack
        x = node.circle_x;
        y = node.circle_y;
        fill = colorScale(node.genus_name);
      } else if (storyStep === 3) {
        // Separated allergenic and non-allergenic
        x = node.allergenic_x || node.circle_x; // Fallback to circle_x if not set
        y = node.allergenic_y || node.circle_y; // Fallback to circle_y if not set
        fill = node.highlighted ? colorScale(node.genus_name) : "#ccc";
      } else if (storyStep === 4) {
        // Beeswarm by diameter
        x = node.beeswarm_x;
        y = node.beeswarm_y;
        fill = colorScale(node.genus_name);
      } else if (storyStep === 5) {
        // Beeswarm by genus
        x = node.genus_x;
        y = node.genus_y;
        fill = colorScale(node.genus_name);
      } else if (storyStep === 6) {
        // Timeline view - now calculated directly above
        x = node.timeline_x || 0; // Default to 0 if not set
        y = node.timeline_y || 0; // Default to 0 if not set

        // Only show nodes that have timeline positions
        if (!node.timeline_x) {
          // Hide nodes that don't have allergenicity in any month
          x = -1000; // Position off-screen
          y = -1000;
        }

        // Set color based on allergenicity level
        fill =
          node.timeline_level === 2
            ? d3.color(colorScale(node.genus_name)).darker(0.5) // Darker for high allergenic
            : colorScale(node.genus_name);
      }
      // Treemap view is handled by the TreemapView component

      return {
        ...node,
        x,
        y,
        fill,
      };
    });
  }

  onMount(() => {
    // When component mounts, measure the navigation container height
    if (navContainer) {
      navHeight = navContainer.offsetHeight;
    }

    if (clientWidth && effectiveHeight > 0) {
      calculateAllPositions();
    }
  });

  afterUpdate(() => {
    // Update measurements after any DOM changes
    if (navContainer) {
      navHeight = navContainer.offsetHeight;
    }
  });
</script>

<svelte:window bind:innerHeight={windowHeight} />

<div class="story-container">
  <h1>Trees in my Neighborhood</h1>

  <div class="step-indicator">
    <p>{storySteps[storyStep - 1]}</p>
  </div>

  <div class="vis-wrapper">
    <div class="container" bind:this={container} bind:clientWidth>
      {#if storyStep <= 5}
        <svg width={clientWidth} height={effectiveHeight}>
          {#if storyStep === 5}
            <!-- No static labels per user request -->
          {/if}

          {#if storyStep === 4}
            <!-- X-axis for beeswarm -->
            {#if clientWidth > 0}
              {@const dbhScale = d3
                .scaleLinear()
                .domain([
                  d3.min(nodes, (d) => +d.tree_dbh || 0),
                  d3.max(nodes, (d) => +d.tree_dbh || 0) * 1.05,
                ])
                .range([
                  margin.left + 15,
                  margin.left + clientWidth + margin.right + 15,
                ])}

              <g
                transform={`translate(0,${margin.top + effectiveHeight - margin.bottom - 40})`}
              >
                {#each dbhScale.ticks(8) as tick}
                  <line
                    x1={dbhScale(tick)}
                    y1={-5}
                    x2={dbhScale(tick)}
                    y2={5}
                    stroke="black"
                  />
                  <text
                    x={dbhScale(tick)}
                    y={20}
                    text-anchor="middle"
                    font-size="12px"
                  >
                    {tick.toFixed(1)}
                  </text>
                {/each}
                <text
                  x={(margin.left + clientWidth) / 2}
                  y={35}
                  text-anchor="middle"
                  font-size="14px"
                >
                  Tree Diameter at Breast Height (DBH) in inches
                </text>
              </g>
            {/if}
          {/if}

          <!-- Circles -->
          {#each nodes as node (node.id)}
            <circle
              cx={node.x}
              cy={node.y}
              r={node.radius}
              fill={$highlightedNodes(node) ? node.fill : "#ccc"}
              stroke="#fff"
              stroke-width="1"
              opacity={$highlightedNodes(node) ? 0.9 : 0.4}
              transform-origin="center center"
              on:mouseover={(e) => handleMouseOver(node, e)}
              on:mouseout={handleMouseOut}
              on:click={() => handleCircleClick(node)}
            />
          {/each}
        </svg>
      {:else}
        <!-- Timeline View (integrated directly) -->
        <svg width={clientWidth} height={effectiveHeight}>
          <!-- Define constants for scales -->
          {#if clientWidth > 0}
            {@const months = [
              "Dec",
              "Jan",
              "Feb",
              "Mar",
              "Apr",
              "May",
              "Jun",
              "Jul",
              "Aug",
              "Sep",
              "Oct",
              "Nov",
            ]}
            {@const visWidth = clientWidth - margin.left - margin.right}
            {@const visHeight = effectiveHeight - margin.top - margin.bottom}
            {@const monthScale = d3
              .scaleBand()
              .domain(months)
              .range([margin.left, margin.left + visWidth])
              .padding(0.1)}

            <!-- Season boundaries and labels -->
            <!-- Winter: Dec, Jan, Feb -->
            {@const winterStart = monthScale("Dec")}
            {@const winterEnd = monthScale("Feb") + monthScale.bandwidth()}
            <rect
              x={winterStart}
              y={margin.top}
              width={monthScale.bandwidth() * 3 + monthScale.step() * 2}
              height={visHeight}
              fill="#e8f0f5"
              opacity="0.3"
            ></rect>
            <text
              x={winterStart + (winterEnd - winterStart) / 2}
              y={margin.top / 2}
              text-anchor="middle"
              font-size="14px"
              font-weight="bold">Winter</text
            >

            <!-- Spring: Mar, Apr, May -->
            {@const springStart = monthScale("Mar")}
            {@const springEnd = monthScale("May") + monthScale.bandwidth()}
            <rect
              x={springStart}
              y={margin.top}
              width={monthScale.bandwidth() * 3 + monthScale.step() * 2}
              height={visHeight}
              fill="#e6f5e6"
              opacity="0.3"
            ></rect>
            <text
              x={springStart + (springEnd - springStart) / 2}
              y={margin.top / 2}
              text-anchor="middle"
              font-size="14px"
              font-weight="bold">Spring</text
            >

            <!-- Summer: Jun, Jul, Aug -->
            {@const summerStart = monthScale("Jun")}
            {@const summerEnd = monthScale("Aug") + monthScale.bandwidth()}
            <rect
              x={summerStart}
              y={margin.top}
              width={monthScale.bandwidth() * 3 + monthScale.step() * 2}
              height={visHeight}
              fill="#f5f0e6"
              opacity="0.3"
            ></rect>
            <text
              x={summerStart + (summerEnd - summerStart) / 2}
              y={margin.top / 2}
              text-anchor="middle"
              font-size="14px"
              font-weight="bold">Summer</text
            >

            <!-- Fall: Sep, Oct, Nov -->
            {@const fallStart = monthScale("Sep")}
            {@const fallEnd = monthScale("Nov") + monthScale.bandwidth()}
            <rect
              x={fallStart}
              y={margin.top}
              width={monthScale.bandwidth() * 3 + monthScale.step() * 2}
              height={visHeight}
              fill="#f5e6e6"
              opacity="0.3"
            ></rect>
            <text
              x={fallStart + (fallEnd - fallStart) / 2}
              y={margin.top / 2}
              text-anchor="middle"
              font-size="14px"
              font-weight="bold">Fall</text
            >

            <!-- Month labels -->
            {#each months as month, i}
              <text
                x={monthScale(month) + monthScale.bandwidth() / 2}
                y={effectiveHeight - margin.bottom / 2}
                text-anchor="middle"
                font-size="12px">{month}</text
              >

              <!-- Month grid lines -->
              <line
                x1={monthScale(month)}
                y1={margin.top}
                x2={monthScale(month)}
                y2={effectiveHeight - margin.bottom}
                stroke="#ddd"
                stroke-width="1"
              ></line>
            {/each}

            <!-- Tree circles -->
            {#each nodes.filter((n) => n.timeline_x) as node}
              <circle
                cx={node.x}
                cy={node.y}
                r={node.timeline_level === 2 ? node.radius * 1.3 : node.radius}
                fill={$highlightedNodes(node) ? node.fill : "#ccc"}
                stroke="#fff"
                stroke-width="1"
                opacity={$highlightedNodes(node) ? 0.9 : 0.4}
                transform-origin="center center"
                on:mouseover={(e) => handleMouseOver(node, e)}
                on:mouseout={handleMouseOut}
                on:click={() => handleCircleClick(node)}
              >
                <title
                  >{node.timeline_month}: {node.timeline_level === 1
                    ? "Moderate"
                    : "High"} Allergenicity</title
                >
              </circle>
            {/each}
          {/if}
        </svg>
      {/if}
    </div>
  </div>

  <div class="nav-container" bind:this={navContainer}>
    <button on:click={prevStep} disabled={storyStep === 1}> Previous </button>
    <span class="step-dots">
      {#each Array(TOTAL_STEPS) as _, i}
        <span class="dot" class:active={storyStep === i + 1}></span>
      {/each}
    </span>
    <button on:click={nextStep} disabled={storyStep === TOTAL_STEPS}>
      Next
    </button>
  </div>

  <!-- Tooltip component -->
  <Tooltip />

  <!-- Filter/Legend component -->
  <FilterLegend data={validatedData} />

  <!-- Color Legend component -->
  <ColorLegend {colorScale} {genera} />
</div>

<style>
  :global(*) {
    font-family:
      Inter,
      -apple-system,
      system-ui;
    -moz-osx-font-smoothing: grayscale;
    box-sizing: border-box;
  }

  .story-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    width: 100%;
    max-width: 1200px;
    margin: 0 auto;
    padding: 1rem;
  }

  h1 {
    margin: 0 0 0.5rem 0;
    font-size: 1.5rem;
    font-weight: 600;
    text-align: center;
  }

  .step-indicator {
    margin-bottom: 1rem;
    font-size: 1.1rem;
    text-align: center;
    background-color: #f0f0f0;
    padding: 0.5rem 1rem;
    border-radius: 4px;
    width: 100%;
  }

  .vis-wrapper {
    width: 100%;
    display: flex;
    justify-content: center;
    align-items: flex-start;
  }

  .container {
    width: 100%;
    position: relative;
    background-color: #f8f9fa;
    border-radius: 8px;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    overflow: hidden;
    height: auto;
  }

  .nav-container {
    display: flex;
    justify-content: space-between;
    align-items: center;
    width: 100%;
    margin-top: 1.5rem;
    padding: 0.5rem;
  }

  button {
    background-color: #4caf50;
    border: none;
    color: white;
    padding: 10px 20px;
    text-align: center;
    text-decoration: none;
    font-size: 16px;
    cursor: pointer;
    border-radius: 4px;
    transition: background-color 0.3s;
  }

  button:hover:not(:disabled) {
    background-color: #45a049;
  }

  button:disabled {
    background-color: #cccccc;
    color: #666666;
    cursor: not-allowed;
  }

  .step-dots {
    display: flex;
    gap: 8px;
  }

  .dot {
    width: 12px;
    height: 12px;
    background-color: #ddd;
    border-radius: 50%;
    display: inline-block;
  }

  .dot.active {
    background-color: #4caf50;
  }

  p {
    margin: 0.5rem 0;
  }

  circle {
    transition:
      cx 1s ease,
      cy 1s ease,
      r 1s ease,
      fill 1s ease,
      opacity 0.3s ease;
    cursor: pointer;
  }

  text {
    font-family: sans-serif;
  }
</style>
