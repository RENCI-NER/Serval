<script setup lang="ts">
defineProps<{
}>()

const urls = new URLSearchParams(window.location.search).getAll('url');
</script>

<template>
  <h2>URLs</h2>
  <ul>
    <li v-for="url in urls" :key="url">
      <a :href="url" target="_blank">{{ url }}</a>
    </li>
  </ul>
</template>

<style>
</style>
