<script lang="ts">import { onMount } from 'svelte';
import type { Skill } from '$lib/types/skill';
export let skills: Skill[] = [];
let selectedSkill: Skill | null = null;
let treeContainer: HTMLDivElement;
let scale = 1;
let translateX = 0;
let translateY = 0;
let isDragging = false;
let dragStart = { x: 0, y: 0 };
$: skillsByLevel = organizeSkillsByLevel(skills);
function organizeSkillsByLevel(skills: Skill[]) {
    const levels: Record<number, Skill[]> = {};
    skills.forEach(skill => {
        if (!levels[skill.level]) {
            levels[skill.level] = [];
        }
        levels[skill.level].push(skill);
    });
    return levels;
}
function handleWheel(e: WheelEvent) {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    scale = Math.max(0.3, Math.min(2, scale * delta));
}
function handleMouseDown(e: MouseEvent) {
    isDragging = true;
    dragStart = { x: e.clientX - translateX, y: e.clientY - translateY };
}
function handleMouseMove(e: MouseEvent) {
    if (!isDragging)
        return;
    translateX = e.clientX - dragStart.x;
    translateY = e.clientY - dragStart.y;
}
function handleMouseUp() {
    isDragging = false;
}
function selectSkill(skill: Skill) {
    selectedSkill = selectedSkill?.id === skill.id ? null : skill;
}
function getSkillPosition(skill: Skill, index: number, levelCount: number) {
    const levelHeight = 180;
    const itemSpacing = 200;
    const y = skill.level * levelHeight + 100;
    const totalWidth = (levelCount - 1) * itemSpacing;
    const x = index * itemSpacing - totalWidth / 2 + 400;
    return { x, y };
}
function getConnectionPath(parent: Skill, child: Skill, parentIndex: number, childIndex: number, parentLevelCount: number, childLevelCount: number) {
    const start = getSkillPosition(parent, parentIndex, parentLevelCount);
    const end = getSkillPosition(child, childIndex, childLevelCount);
    const midY = (start.y + end.y) / 2;
    return `M ${start.x} ${start.y + 40} 
            C ${start.x} ${midY}, 
              ${end.x} ${midY}, 
              ${end.x} ${end.y - 40}`;
}
onMount(() => {
    treeContainer.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
        treeContainer.removeEventListener('wheel', handleWheel);
    };
});
</script>

<div 
  class="skill-tree-container"
  bind:this={treeContainer}
  on:mousedown={handleMouseDown}
  on:mousemove={handleMouseMove}
  on:mouseup={handleMouseUp}
  on:mouseleave={handleMouseUp}
>
  <div class="tree-controls">
    <button on:click={() => scale = Math.min(2, scale + 0.1)}>+</button>
    <button on:click={() => scale = Math.max(0.3, scale - 0.1)}>−</button>
    <button on:click={() => { scale = 1; translateX = 0; translateY = 0; }}>⊙</button>
  </div>
  
  <svg 
    class="tree-canvas"
    style="transform: translate({translateX}px, {translateY}px) scale({scale})"
  >
    
    {#each skills as parent, i}
      {#if parent.children}
        {#each parent.children as childId}
          {@const child = skills.find(s => s.id === childId)}
          {#if child}
            {@const parentLevel = skillsByLevel[parent.level]}
            {@const childLevel = skillsByLevel[child.level]}
            {@const parentIndex = parentLevel.indexOf(parent)}
            {@const childIndex = childLevel.indexOf(child)}
            <path
              class="connection"
              class:unlocked={child.unlocked}
              d={getConnectionPath(parent, child, parentIndex, childIndex, parentLevel.length, childLevel.length)}
              stroke={child.unlocked ? child.color : 'rgba(255,255,255,0.1)'}
              stroke-width="2"
              fill="none"
              opacity={child.unlocked ? 0.6 : 0.2}
            />
          {/if}
        {/each}
      {/if}
    {/each}
    
    
    {#each Object.entries(skillsByLevel) as [level, levelSkills]}
      {#each levelSkills as skill, index}
        {@const pos = getSkillPosition(skill, index, levelSkills.length)}
        <g 
          class="skill-node"
          class:unlocked={skill.unlocked}
          class:selected={selectedSkill?.id === skill.id}
          on:click={() => selectSkill(skill)}
          style="cursor: pointer;"
        >
          
          {#if skill.unlocked}
            <circle
              cx={pos.x}
              cy={pos.y}
              r="45"
              fill="none"
              stroke={skill.color}
              stroke-width="2"
              opacity="0.3"
            />
          {/if}
          
          
          <circle
            cx={pos.x}
            cy={pos.y}
            r="35"
            fill={skill.unlocked ? skill.color + '20' : 'rgba(255,255,255,0.03)'}
            stroke={skill.unlocked ? skill.color : 'rgba(255,255,255,0.15)'}
            stroke-width="2"
          />
          
          
          {#if skill.executionPlan}
            <circle
              cx={pos.x + 25}
              cy={pos.y - 25}
              r="6"
              fill="#34d399"
              stroke="white"
              stroke-width="1"
            >
              <title>Has reusable execution plan</title>
            </circle>
          {/if}
          
          
          <text
            x={pos.x}
            y={pos.y + 5}
            text-anchor="middle"
            font-size="12"
            font-weight="700"
            fill={skill.unlocked ? 'white' : 'rgba(255,255,255,0.3)'}
          >
            {skill.name.length > 12 ? skill.name.substring(0, 10) + '...' : skill.name}
          </text>
          
          
          <text
            x={pos.x}
            y={pos.y + 55}
            text-anchor="middle"
            font-size="9"
            fill={skill.unlocked ? skill.color : 'rgba(255,255,255,0.2)'}
          >
            Lv.{skill.level}
          </text>
        </g>
      {/each}
    {/each}
  </svg>
  
  
  {#if selectedSkill}
    <div class="skill-detail">
      <button class="close-btn" on:click={() => selectedSkill = null}>×</button>
      <div class="skill-icon" style="background: {selectedSkill.color}20; border-color: {selectedSkill.color}">
        <span style="color: {selectedSkill.color}">◈</span>
      </div>
      <h3>{selectedSkill.name}</h3>
      <p class="skill-description">{selectedSkill.description}</p>
      <div class="skill-meta">
        <span class="meta-item">
          <span class="meta-label">Level</span>
          <span class="meta-value">{selectedSkill.level}</span>
        </span>
        <span class="meta-item">
          <span class="meta-label">Status</span>
          <span class="meta-value" class:unlocked={selectedSkill.unlocked}>
            {selectedSkill.unlocked ? 'Unlocked' : 'Locked'}
          </span>
        </span>
      </div>
      
      {#if selectedSkill.actions && selectedSkill.actions.length > 0}
        <div class="skill-actions">
          <h4>Actions:</h4>
          <ul>
            {#each selectedSkill.actions as action}
              <li>{action}</li>
            {/each}
          </ul>
        </div>
      {/if}
      
      {#if selectedSkill.executionPlan}
        <div class="skill-execution-plan">
          <h4>Learned From:</h4>
          <p class="original-task">"{selectedSkill.executionPlan.originalTask}"</p>
          <div class="plan-stats">
            <span class="plan-badge">🔄 Repeatable</span>
            {#if selectedSkill.metadata?.timesUsed}
              <span class="plan-badge">Used {selectedSkill.metadata.timesUsed}x</span>
            {/if}
          </div>
        </div>
      {/if}
      
      {#if selectedSkill.children && selectedSkill.children.length > 0}
        <div class="skill-children">
          <h4>Unlocks:</h4>
          <div class="children-list">
            {#each selectedSkill.children as childId}
              {@const child = skills.find(s => s.id === childId)}
              {#if child}
                <span class="child-badge" style="border-color: {child.color}">
                  {child.name}
                </span>
              {/if}
            {/each}
          </div>
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .skill-tree-container {
    position: relative;
    width: 100%;
    height: 100%;
    overflow: hidden;
    background: rgba(7,7,16,0.4);
    cursor: grab;
  }

  .skill-tree-container:active {
    cursor: grabbing;
  }

  .tree-controls {
    position: absolute;
    top: 1rem;
    right: 1rem;
    z-index: 10;
    display: flex;
    gap: 0.5rem;
  }

  .tree-controls button {
    width: 36px;
    height: 36px;
    background: rgba(0,245,255,0.1);
    border: 1px solid rgba(0,245,255,0.3);
    color: #00f5ff;
    font-size: 1.2rem;
    cursor: pointer;
    transition: all 0.2s;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .tree-controls button:hover {
    background: rgba(0,245,255,0.2);
    border-color: rgba(0,245,255,0.6);
  }

  .tree-canvas {
    width: 100%;
    height: 100%;
    transform-origin: center center;
    transition: transform 0.1s ease-out;
  }

  .skill-node {
    transition: all 0.3s;
  }

  .skill-node:hover circle {
    stroke-width: 3;
  }

  .skill-node.unlocked circle {
    filter: drop-shadow(0 0 10px currentColor);
  }

  .skill-node.selected circle {
    stroke-width: 4 !important;
  }

  .connection {
    transition: all 0.3s;
  }

  .connection.unlocked {
    stroke-dasharray: 5, 5;
    animation: dash 20s linear infinite;
  }

  @keyframes dash {
    to {
      stroke-dashoffset: -200;
    }
  }

  .skill-detail {
    position: absolute;
    top: 50%;
    right: 2rem;
    transform: translateY(-50%);
    width: 280px;
    background: rgba(13,13,26,0.95);
    border: 1px solid rgba(255,255,255,0.15);
    border-radius: 12px;
    padding: 1.5rem;
    backdrop-filter: blur(12px);
    box-shadow: 0 8px 32px rgba(0,0,0,0.4);
    z-index: 20;
  }

  .close-btn {
    position: absolute;
    top: 0.5rem;
    right: 0.5rem;
    width: 28px;
    height: 28px;
    background: transparent;
    border: none;
    color: rgba(255,255,255,0.5);
    font-size: 1.5rem;
    cursor: pointer;
    transition: color 0.2s;
  }

  .close-btn:hover {
    color: #ff4ecd;
  }

  .skill-icon {
    width: 60px;
    height: 60px;
    border-radius: 50%;
    border: 2px solid;
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 0 auto 1rem;
    font-size: 2rem;
  }

  .skill-detail h3 {
    font-family: 'Syne', sans-serif;
    font-size: 1.3rem;
    font-weight: 800;
    color: white;
    text-align: center;
    margin-bottom: 0.75rem;
  }

  .skill-description {
    font-size: 0.8rem;
    color: rgba(255,255,255,0.5);
    line-height: 1.6;
    margin-bottom: 1rem;
    text-align: center;
  }

  .skill-meta {
    display: flex;
    justify-content: space-around;
    padding: 1rem 0;
    border-top: 1px solid rgba(255,255,255,0.1);
    border-bottom: 1px solid rgba(255,255,255,0.1);
    margin-bottom: 1rem;
  }

  .meta-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.25rem;
  }

  .meta-label {
    font-size: 0.65rem;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: rgba(255,255,255,0.4);
  }

  .meta-value {
    font-size: 0.9rem;
    font-weight: 700;
    color: white;
  }

  .meta-value.unlocked {
    color: #34d399;
  }

  .skill-actions,
  .skill-children {
    margin-top: 1rem;
  }

  .skill-actions h4,
  .skill-children h4 {
    font-size: 0.75rem;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: rgba(255,255,255,0.6);
    margin-bottom: 0.5rem;
  }

  .skill-actions ul {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .skill-actions li {
    font-size: 0.75rem;
    color: rgba(255,255,255,0.5);
    padding-left: 1rem;
    position: relative;
  }

  .skill-actions li::before {
    content: '▸';
    position: absolute;
    left: 0;
    color: #00f5ff;
  }

  .children-list {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  .child-badge {
    font-size: 0.7rem;
    padding: 0.25rem 0.75rem;
    border: 1px solid;
    border-radius: 12px;
    background: rgba(255,255,255,0.03);
  }
  
  .skill-execution-plan {
    margin-top: 1rem;
    padding-top: 1rem;
    border-top: 1px solid rgba(255,255,255,0.1);
  }
  
  .skill-execution-plan h4 {
    font-size: 0.75rem;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: rgba(255,255,255,0.6);
    margin-bottom: 0.5rem;
  }
  
  .original-task {
    font-size: 0.75rem;
    color: rgba(255,255,255,0.5);
    font-style: italic;
    line-height: 1.6;
    margin-bottom: 0.75rem;
  }
  
  .plan-stats {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
  }
  
  .plan-badge {
    font-size: 0.65rem;
    padding: 0.25rem 0.6rem;
    background: rgba(52,211,153,0.1);
    border: 1px solid rgba(52,211,153,0.3);
    border-radius: 10px;
    color: #34d399;
  }
</style>
