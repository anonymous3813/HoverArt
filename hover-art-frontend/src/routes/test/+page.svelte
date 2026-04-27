<script lang="ts">
	import { onMount } from 'svelte';
	import * as THREE from 'three';
	import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

	let container: HTMLDivElement;

	let mixer: THREE.AnimationMixer;
	let actions: Record<string, THREE.AnimationAction> = {};
	let activeAction: THREE.AnimationAction | null = null;

	let animationNames: string[] = [];
	let clock = new THREE.Clock();

	onMount(() => {
		// Scene
		const scene = new THREE.Scene();
		scene.background = new THREE.Color(0x222222);

		// Camera
		const camera = new THREE.PerspectiveCamera(
			60,
			window.innerWidth / window.innerHeight,
			0.1,
			100
		);
		camera.position.set(0, 1.5, 3);

		// Renderer
		const renderer = new THREE.WebGLRenderer({ antialias: true });
		renderer.setSize(window.innerWidth, window.innerHeight);
		container.appendChild(renderer.domElement);

		// Light
		const light = new THREE.DirectionalLight(0xffffff, 2);
		light.position.set(2, 5, 5);
		scene.add(light);

		// Load GLB
		const loader = new GLTFLoader();
		loader.load('/models/boxer.glb', (gltf) => {
			scene.add(gltf.scene);

			// Mixer
			mixer = new THREE.AnimationMixer(gltf.scene);

			// Build actions map
			gltf.animations.forEach((clip) => {
				const action = mixer.clipAction(clip);
				actions[clip.name] = action;
			});

			// Store names for UI
			animationNames = Object.keys(actions);

			console.log('Animations:', animationNames);

			// Auto-play first animation
			if (animationNames.length > 0) {
				playAnimation(animationNames[0]);
			}
		});

		// Render loop
		function animate() {
			requestAnimationFrame(animate);

			const delta = clock.getDelta();
			if (mixer) mixer.update(delta);

			renderer.render(scene, camera);
		}
		animate();

		// Resize
		window.addEventListener('resize', () => {
			camera.aspect = window.innerWidth / window.innerHeight;
			camera.updateProjectionMatrix();
			renderer.setSize(window.innerWidth, window.innerHeight);
		});
	});

	function playAnimation(name: string) {
		const next = actions[name];
		if (!next) return;

		if (activeAction) {
			activeAction.fadeOut(0.2);
		}

		activeAction = next;
		next.reset().fadeIn(0.2).play();

		console.log('Playing:', name);
	}
</script>

<style>
	.ui {
		position: absolute;
		top: 10px;
		left: 10px;
		display: flex;
		flex-direction: column;
		gap: 6px;
		z-index: 10;
	}

	button {
		padding: 6px 10px;
		background: #333;
		color: white;
		border: 1px solid #555;
		cursor: pointer;
		border-radius: 4px;
	}

	button:hover {
		background: #444;
	}
</style>

<div bind:this={container} style="width: 100vw; height: 100vh;"></div>

<div class="ui">
	{#if animationNames.length === 0}
		<p style="color:white;">Loading animations...</p>
	{:else}
		{#each animationNames as name}
			<button on:click={() => playAnimation(name)}>
				{name}
			</button>
		{/each}
	{/if}
</div>