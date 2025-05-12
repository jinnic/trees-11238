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
  export let margin = { top: 40, right: 20, bottom: 40, left: 20 };
  export let colorScale; // For genus colors

  // Internal state
  let svgElement;
  let nodes = [];
  let treemapData = null;

  // Month names
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

  // Season groups
  const seasons = [
    { name: "Winter", months: [0, 1, 11] }, // Jan, Feb, Dec
    { name: "Spring", months: [2, 3, 4] }, // Mar, Apr, May
    { name: "Summer", months: [5, 6, 7] }, // Jun, Jul, Aug
    { name: "Fall", months: [8, 9, 10] }, // Sep, Oct, Nov
  ];

  // Assign months to trees (for demonstration)
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
        // Use common_name as species, or fallback to genus_name if no common_name
        species: d.common_name || `${d.genus_name} (unspecified)`,
      };
    });
  }

  // Create hierarchical data structure for treemap
  function createTreemapData() {
    // First assign months if needed
    const treesWithMonths = assignMonthToTrees();

    // Create a hierarchical structure: Root -> Month -> Genus -> Species -> Trees
    const hierarchy = {
      name: "All Trees",
      children: [],
    };

    // Group by month
    const monthGroups = d3.group(treesWithMonths, (d) => d.month);

    // For each month, create a child node
    monthGroups.forEach((trees, month) => {
      const monthNode = {
        name: months[month],
        month: +month,
        children: [],
      };

      // Group by genus within this month
      const genusGroups = d3.group(trees, (d) => d.genus_name);

      // For each genus, create a child node
      genusGroups.forEach((genusTrees, genus) => {
        const genusNode = {
          name: genus,
          genus: genus,
          size: genusTrees.length, // Total trees in this genus
          children: [],
        };

        // Group by species within this genus
        const speciesGroups = d3.group(genusTrees, (d) => d.species);

        // For each species, create a child node with the actual trees
        speciesGroups.forEach((speciesTrees, species) => {
          genusNode.children.push({
            name: species,
            genus: genus,
            species: species,
            size: speciesTrees.length,
            trees: speciesTrees, // Store the actual tree objects
          });
        });

        monthNode.children.push(genusNode);
      });

      hierarchy.children.push(monthNode);
    });

    return hierarchy;
  }

  // Calculate treemap layout
  function calculateTreemapLayout() {
    if (!data || data.length === 0) return;

    // Create hierarchical data
    const rootData = createTreemapData();

    // Calculate dimensions for the grid
    const visWidth = width - margin.left - margin.right;
    const visHeight = height - margin.top - margin.bottom;

    // Group months by season for better organization
    const seasonGroups = seasons.map((season) => {
      return {
        name: season.name,
        months: season.months
          .map((m) => rootData.children.find((child) => child.month === m))
          .filter(Boolean),
      };
    });

    // Create a grid of 4 treemaps (one per season)
    const cellWidth = visWidth / 2; // 2 columns
    const cellHeight = visHeight / 2; // 2 rows

    // Define season positions
    const seasonPositions = [
      { name: "Winter", x: 0, y: 0 }, // Top-left
      { name: "Spring", x: cellWidth, y: 0 }, // Top-right
      { name: "Summer", x: 0, y: cellHeight }, // Bottom-left
      { name: "Fall", x: cellWidth, y: cellHeight }, // Bottom-right
    ];

    // Create treemap nodes for each season
    const treemapNodes = [];

    seasonPositions.forEach((seasonPos) => {
      // Find this season
      const season = seasonGroups.find((s) => s.name === seasonPos.name);
      if (!season || !season.months.length) return;

      // Create a hierarchy for all months in this season
      const seasonData = {
        name: seasonPos.name,
        children: season.months,
      };

      // Convert to d3 hierarchy
      const root = d3
        .hierarchy(seasonData)
        .sum((d) => d.size || 0)
        .sort((a, b) => b.value - a.value);

      // Create a treemap layout
      const treemap = d3
        .treemap()
        .size([cellWidth - 10, cellHeight - 50]) // Leave space for labels
        .padding(3)
        .round(true);

      // Apply treemap layout
      treemap(root);

      // Extract nodes and add season and position info
      const seasonNodes = [];

      // Add the season label
      seasonNodes.push({
        type: "season-label",
        name: seasonPos.name,
        x: seasonPos.x + margin.left + cellWidth / 2,
        y: seasonPos.y + margin.top + 15,
        width: 0,
        height: 0,
      });

      // Process month nodes
      root.children?.forEach((monthNode) => {
        if (!monthNode.children) return;

        // Add the month node
        seasonNodes.push({
          type: "month",
          name: monthNode.data.name,
          month: monthNode.data.month,
          x: monthNode.x0 + seasonPos.x + margin.left,
          y: monthNode.y0 + seasonPos.y + margin.top + 30, // Offset for season label
          width: monthNode.x1 - monthNode.x0,
          height: monthNode.y1 - monthNode.y0,
        });

        // Process genus nodes
        monthNode.children.forEach((genusNode) => {
          // Add genus node
          const genusName = genusNode.data.name;
          seasonNodes.push({
            type: "genus",
            name: genusName,
            genus: genusName,
            count: genusNode.value,
            x: genusNode.x0 + seasonPos.x + margin.left,
            y: genusNode.y0 + seasonPos.y + margin.top + 30,
            width: genusNode.x1 - genusNode.x0,
            height: genusNode.y1 - genusNode.y0,
            color: colorScale(genusName),
          });

          // Process species nodes
          genusNode.children?.forEach((speciesNode) => {
            // Add species node
            seasonNodes.push({
              type: "species",
              name: speciesNode.data.name,
              genus: genusName,
              species: speciesNode.data.species,
              count: speciesNode.value,
              trees: speciesNode.data.trees || [],
              x: speciesNode.x0 + seasonPos.x + margin.left,
              y: speciesNode.y0 + seasonPos.y + margin.top + 30,
              width: speciesNode.x1 - speciesNode.x0,
              height: speciesNode.y1 - speciesNode.y0,
              color: colorScale(genusName),
            });
          });
        });
      });

      treemapNodes.push(...seasonNodes);
    });

    nodes = treemapNodes;
  }

  // Handle hover events
  function handleNodeHover(node, event) {
    if (node.type === "species" && node.trees && node.trees.length > 0) {
      // Show info about the first tree as representative
      const tree = node.trees[0];
      $hoveredNode = {
        ...tree,
        x: event.clientX,
        y: event.clientY,
        // Add extra info for species node
        speciesCount: node.count,
        speciesName: node.name,
      };
    } else if (node.type === "genus") {
      // For genus nodes, create a basic info object
      $hoveredNode = {
        genus_name: node.name,
        count: node.count,
        x: event.clientX,
        y: event.clientY,
      };
    }
  }

  function handleMouseOut() {
    $hoveredNode = null;
  }

  // Handle click to toggle genus filter
  function handleNodeClick(node) {
    if (node.genus) {
      // Toggle the genus in the filter
      if ($selectedGenera.includes(node.genus)) {
        $selectedGenera = $selectedGenera.filter((g) => g !== node.genus);
      } else {
        $selectedGenera = [...$selectedGenera, node.genus];
      }
    }
  }

  // Calculate treemap when data or dimensions change
  $: if (data && data.length > 0 && width && height) {
    calculateTreemapLayout();
  }

  onMount(() => {
    if (data && data.length > 0) {
      calculateTreemapLayout();
    }
  });
</script>

<div class="treemap-container">
  <svg {width} {height}>
    <!-- Season and month rectangles -->
    {#each nodes.filter((n) => n.type === "month") as node}
      <rect
        x={node.x}
        y={node.y}
        width={node.width}
        height={node.height}
        fill="none"
        stroke="#ddd"
        stroke-width="1"
      />
      <!-- Month labels -->
      <text
        x={node.x + node.width / 2}
        y={node.y - 5}
        text-anchor="middle"
        font-size="10px"
        fill="#666"
      >
        {node.name}
      </text>
    {/each}

    <!-- Season labels -->
    {#each nodes.filter((n) => n.type === "season-label") as node}
      <text
        x={node.x}
        y={node.y}
        text-anchor="middle"
        font-size="16px"
        font-weight="bold"
        fill="#333"
      >
        {node.name}
      </text>
    {/each}

    <!-- Genus rectangles -->
    {#each nodes.filter((n) => n.type === "genus") as node}
      <rect
        x={node.x}
        y={node.y}
        width={node.width}
        height={node.height}
        fill="none"
        stroke="#999"
        stroke-width="1"
        on:mouseover={(e) => handleNodeHover(node, e)}
        on:mouseout={handleMouseOut}
        on:click={() => handleNodeClick(node)}
      />
      <!-- Only show genus label if rectangle is large enough -->
      {#if node.width > 60 && node.height > 20}
        <text
          x={node.x + node.width / 2}
          y={node.y + 12}
          text-anchor="middle"
          font-size="10px"
          fill="#333"
          pointer-events="none"
        >
          {node.name}
        </text>
      {/if}
    {/each}

    <!-- Species rectangles -->
    {#each nodes.filter((n) => n.type === "species") as node}
      <rect
        x={node.x}
        y={node.y}
        width={node.width}
        height={node.height}
        fill={$highlightedNodes(node.trees[0]) ? node.color : "#ccc"}
        opacity={$highlightedNodes(node.trees[0]) ? 0.8 : 0.4}
        stroke="#fff"
        stroke-width="0.5"
        on:mouseover={(e) => handleNodeHover(node, e)}
        on:mouseout={handleMouseOut}
        on:click={() => handleNodeClick(node)}
        class="species-rect"
      />
      <!-- Only show species label if rectangle is large enough -->
      {#if node.width > 70 && node.height > 25}
        <text
          x={node.x + node.width / 2}
          y={node.y + node.height / 2}
          text-anchor="middle"
          dominant-baseline="middle"
          font-size="9px"
          fill="#fff"
          pointer-events="none"
        >
          {node.name}
        </text>
      {/if}
    {/each}
  </svg>
</div>

<style>
  .treemap-container {
    width: 100%;
    height: 100%;
    position: relative;
  }

  svg {
    display: block;
  }

  .species-rect {
    transition:
      fill 0.3s ease,
      opacity 0.3s ease;
    cursor: pointer;
  }

  text {
    pointer-events: none;
    user-select: none;
  }
</style>
