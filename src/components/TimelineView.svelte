<script>
  import { onMount } from "svelte";
  import * as d3 from "d3";
  import {
    hoveredNode,
    highlightedNodes,
    selectedGenera,
  } from "../stores/filterStore";

  export let data = [];
  export let width = 800;
  export let height = 600;
  export let margin = { top: 40, right: 20, bottom: 60, left: 50 };
  export let colorScale; // Accept colorScale as a prop instead of creating internally

  // Simulation nodes
  let nodes = [];

  // Month names for x-axis
  const months = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];

  // Assign random months to trees for demonstration
  // In a real app, this would come from your data
  function assignMonthToTrees() {
    return data.map((d) => {
      // For demonstration, assign month based on allergenicity
      // Non-allergenic: winter months (Dec-Feb)
      // Normal allergenic: spring/summer months (Mar-Aug)
      // Highly allergenic: fall months (Sep-Nov)
      let monthIndex;

      if (d.Allergenicity === 0) {
        // Winter months for non-allergenic
        monthIndex = Math.floor(Math.random() * 3) % 12; // 0, 1, 2 (Jan, Feb, Dec)
        if (monthIndex === 2) monthIndex = 11; // Convert 2 to December (11)
      } else if (d.Allergenicity === 1) {
        // Spring/Summer for moderate allergenic
        monthIndex = Math.floor(Math.random() * 6) + 2; // 2-7 (Mar-Aug)
      } else {
        // Fall for highly allergenic
        monthIndex = Math.floor(Math.random() * 3) + 8; // 8-10 (Sep-Nov)
      }

      return {
        ...d,
        month: monthIndex,
        monthName: months[monthIndex],
      };
    });
  }

  // Calculate positions for timeline view
  function calculateTimelinePositions() {
    // First assign months if needed
    const processedData = assignMonthToTrees();

    // Calculate effective dimensions
    const visWidth = width - margin.left - margin.right;
    const visHeight = height - margin.top - margin.bottom;

    // Create x scale for months
    const xScale = d3
      .scaleBand()
      .domain(d3.range(12)) // 0-11 for months
      .range([margin.left, margin.left + visWidth])
      .padding(0.1);

    // Calculate band width
    const bandWidth = xScale.bandwidth();

    // Group trees first by genus, then by month
    const generaList = [
      ...new Set(processedData.map((d) => d.genus_name)),
    ].sort();

    // Calculate y positions for each genus within each month
    const monthNodes = [];

    // First, group by month
    const treesByMonth = d3.group(processedData, (d) => d.month);

    // For each month, organize trees by genus
    treesByMonth.forEach((monthTrees, month) => {
      // Group this month's trees by genus
      const treesByGenus = d3.group(monthTrees, (d) => d.genus_name);

      // Position in vertical bands by genus
      const monthWidth = bandWidth;
      const centerX = xScale(+month) + monthWidth / 2;

      // Calculate height for each genus based on proportion of total genera
      const genusHeight = visHeight / generaList.length;

      // Process each genus group
      generaList.forEach((genus, genusIndex) => {
        // Get trees of this genus for this month (if any)
        const genusTrees = treesByGenus.get(genus) || [];

        if (genusTrees.length > 0) {
          // Vertical center point for this genus band
          const genusCenterY = margin.top + genusHeight * (genusIndex + 0.5);

          // Create grid layout within each genus band
          const columns = Math.max(1, Math.min(3, genusTrees.length)); // Limit to max 3 columns for readability
          const rows = Math.ceil(genusTrees.length / columns);
          const gridWidth = monthWidth / columns;
          const gridHeight = Math.min(genusHeight / rows, 40); // Limit height to prevent overcrowding

          // Position trees in grid
          genusTrees.forEach((tree, i) => {
            const col = i % columns;
            const row = Math.floor(i / columns);

            // Add small jitter for natural look
            const jitterX = (Math.random() - 0.5) * gridWidth * 0.3;
            const jitterY = (Math.random() - 0.5) * gridHeight * 0.3;

            // Set position - use the provided colorScale instead of creating internally
            monthNodes.push({
              ...tree,
              x:
                centerX -
                monthWidth / 2 +
                col * gridWidth +
                gridWidth / 2 +
                jitterX,
              y:
                genusCenterY -
                (rows * gridHeight) / 2 +
                row * gridHeight +
                gridHeight / 2 +
                jitterY,
              fill: colorScale(genus),
            });
          });
        }
      });
    });

    nodes = monthNodes;
  }

  // Handle hover events
  function handleMouseOver(node, event) {
    $hoveredNode = {
      ...node,
      x: event.clientX,
      y: event.clientY,
    };
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

  // Calculate positions on mount and when data/dimensions change
  $: if (data && data.length > 0 && width && height) {
    calculateTimelinePositions();
  }

  onMount(() => {
    if (data && data.length > 0) {
      calculateTimelinePositions();
    }
  });

  // Generate genus legend data
  $: genusLegend = [];
</script>

<div class="timeline-container">
  <svg {width} {height}>
    <!-- Month axis -->
    {#each months as month, i}
      <text
        x={margin.left +
          ((width - margin.left - margin.right) * (i + 0.5)) / 12}
        y={height - margin.bottom / 2}
        text-anchor="middle"
        font-size="12px"
      >
        {month.substring(0, 3)}
      </text>
    {/each}

    <!-- Month grid lines -->
    {#each Array(13) as _, i}
      <line
        x1={margin.left + ((width - margin.left - margin.right) * i) / 12}
        y1={margin.top}
        x2={margin.left + ((width - margin.left - margin.right) * i) / 12}
        y2={height - margin.bottom}
        stroke="#ddd"
        stroke-width="1"
      />
    {/each}

    <!-- Season labels -->
    <text
      x={width * 0.125}
      y={margin.top / 2}
      text-anchor="middle"
      font-size="14px"
      font-weight="bold">Winter</text
    >
    <text
      x={width * 0.375}
      y={margin.top / 2}
      text-anchor="middle"
      font-size="14px"
      font-weight="bold">Spring</text
    >
    <text
      x={width * 0.625}
      y={margin.top / 2}
      text-anchor="middle"
      font-size="14px"
      font-weight="bold">Summer</text
    >
    <text
      x={width * 0.875}
      y={margin.top / 2}
      text-anchor="middle"
      font-size="14px"
      font-weight="bold">Fall</text
    >

    <!-- Trees -->
    {#each nodes as node}
      <circle
        cx={node.x}
        cy={node.y}
        r={node.radius}
        fill={$highlightedNodes(node) ? node.fill || "#4caf50" : "#ccc"}
        stroke="#fff"
        stroke-width="1"
        opacity={$highlightedNodes(node) ? 0.9 : 0.4}
        on:mouseover={(e) => handleMouseOver(node, e)}
        on:mouseout={handleMouseOut}
        on:click={() => handleCircleClick(node)}
      />
    {/each}
  </svg>
</div>

<style>
  .timeline-container {
    width: 100%;
    height: 100%;
    position: relative;
  }

  svg {
    display: block;
  }

  circle {
    transition:
      cx 0.8s ease,
      cy 0.8s ease,
      r 0.8s ease,
      fill 0.8s ease,
      opacity 0.3s ease;
    cursor: pointer;
  }
</style>
