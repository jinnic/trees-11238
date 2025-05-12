<script>
  import { hoveredNode } from "../stores/filterStore";

  // Position offsets to prevent tooltip from covering the hovered circle
  const OFFSET_X = 15;
  const OFFSET_Y = 15;
</script>

{#if $hoveredNode}
  <div
    class="tooltip"
    style="left: {$hoveredNode.x + OFFSET_X}px; top: {$hoveredNode.y +
      OFFSET_Y}px"
  >
    <!-- For species nodes in treemap -->
    {#if $hoveredNode.speciesCount !== undefined}
      <div class="tooltip-title">
        {$hoveredNode.speciesName}
      </div>
      <div class="tooltip-row">
        <span class="label">Genus:</span>
        <span class="value">{$hoveredNode.genus_name}</span>
      </div>
      <div class="tooltip-row">
        <span class="label">Count:</span>
        <span class="value">{$hoveredNode.speciesCount} trees</span>
      </div>
      <div class="tooltip-row">
        <span class="label">Example DBH:</span>
        <span class="value">{$hoveredNode.tree_dbh || "Unknown"} inches</span>
      </div>
      <div class="tooltip-row">
        <span class="label">Allergenicity:</span>
        <span class="value">
          {#if $hoveredNode.Allergenicity === 0}
            None
          {:else if $hoveredNode.Allergenicity === 1}
            Moderate
          {:else if $hoveredNode.Allergenicity === 2}
            High
          {:else}
            Unknown
          {/if}
        </span>
      </div>
      <!-- For genus info in step 5 -->
    {:else if $hoveredNode.isGenusInfo}
      <div class="tooltip-title genus-title">
        {$hoveredNode.genus_name}
      </div>
      <div class="tooltip-row">
        <span class="label">Count:</span>
        <span class="value">{$hoveredNode.genusCount} trees</span>
      </div>
      <div class="tooltip-row">
        <span class="label">Percentage:</span>
        <span class="value">{$hoveredNode.genusPercentage}% of all trees</span>
      </div>
      <!-- For genus nodes in treemap -->
    {:else if $hoveredNode.count !== undefined && !$hoveredNode.tree_dbh}
      <div class="tooltip-title">
        Genus: {$hoveredNode.genus_name}
      </div>
      <div class="tooltip-row">
        <span class="label">Count:</span>
        <span class="value">{$hoveredNode.count} trees</span>
      </div>
      <!-- For regular tree nodes -->
    {:else}
      <div class="tooltip-title">
        {$hoveredNode.common_name || $hoveredNode.genus_name}
      </div>
      <div class="tooltip-row">
        <span class="label">Genus:</span>
        <span class="value">{$hoveredNode.genus_name}</span>
      </div>
      <div class="tooltip-row">
        <span class="label">Diameter:</span>
        <span class="value">{$hoveredNode.tree_dbh || "Unknown"} inches</span>
      </div>
      <div class="tooltip-row">
        <span class="label">Allergenicity:</span>
        <span class="value">
          {#if $hoveredNode.Allergenicity === 0}
            None
          {:else if $hoveredNode.Allergenicity === 1}
            Moderate
          {:else if $hoveredNode.Allergenicity === 2}
            High
          {:else}
            Unknown
          {/if}
        </span>
      </div>
    {/if}
  </div>
{/if}

<style>
  .tooltip {
    position: absolute;
    background: rgba(255, 255, 255, 0.95);
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
    border-radius: 4px;
    padding: 10px;
    min-width: 200px;
    z-index: 1000;
    font-size: 14px;
    pointer-events: none; /* allows mouse events to pass through */
    transition: opacity 0.2s ease;
  }

  .tooltip-title {
    font-weight: 600;
    margin-bottom: 5px;
    font-size: 16px;
    color: #333;
    border-bottom: 1px solid #eee;
    padding-bottom: 5px;
  }

  .tooltip-row {
    display: flex;
    justify-content: space-between;
    margin-bottom: 3px;
  }

  .label {
    font-weight: 500;
    color: #555;
  }

  .value {
    color: #333;
    font-weight: 400;
  }

  .genus-title {
    color: #1a5d1a;
    font-size: 18px;
  }
</style>
