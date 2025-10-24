<script setup lang="ts">
import "bootstrap/js/dist/collapse";
import {onMounted, ref} from "vue";

defineProps<{
}>()

// 1. Get all URLs from the query string.
const urls = new URLSearchParams(window.location.search).getAll('url');

// 2. Reactive map: url → parsed JSONL array
const loaded = ref(false);
const urlData = ref({});
const annotatedTextByTitle = ref({});
const annotatedTextByAnnotationsDescending = ref({});
const concepts = ref({});

// 3. Helper to load and parse a JSONL file
async function fetchJsonl(url: string): Promise<object[]> {
  const response = await fetch(url);
  const text = await response.text();
  return text
      .split('\n')
      .filter(Boolean)
      .map(JSON.parse);
}

// 4. Load all URLs and map them to dataMap
onMounted(async () => {
  const entries = await Promise.all(
      urls.map(async (url) => [url, await fetchJsonl(url)])
  );
  // Convert array of [url, data] → object like { url: data }
  const entriesByURL = Object.fromEntries(entries.map(entry => {
    const url = entry[0] as string;
    const lines = entry[1] as object[];

    return [url, lines.map(data => ({
      url,
      text: data.text as string,
      annotations: data.annotations as object[],

      // Come up with a title based on the first 100 characters of the text.
      // TODO: renci-ner should produce this itself!
      // Plus GUIDs maybe?
      title: data.text.substring(0, 100) as string,
    }))];
  }));
  urlData.value = entriesByURL;

  // Flatten the data into a single array by title.
  // TODO: this assumes titles are unique!
  concepts.value = {};
  annotatedTextByTitle.value = Object.values(entriesByURL).flat().reduce(function (acc, entry) {
    const title = entry.title as string;
    if (!(title in acc)) {
      acc[title] = {
        title: title,
        url: entry.url,
        text: entry.text,
        annotations: [],
      };
    }
    const new_annotations = (entry.annotations || []);
    if (new_annotations.length > 0) {
      acc[title].annotations.push(...new_annotations);

      // Index concepts
      for(const annotation of new_annotations) {
        // Is this annotation Normalized?
        if ('biolink_type' in annotation) {
          const biolink_type = annotation['biolink_type'] as string;
          const concept_id = annotation['id'] as string;
          const label = annotation['label'] as string;
          const start = annotation['start'] as number;
          const end = annotation['end'] as number;

          if (!(concept_id in concepts.value)) {
            concepts.value[concept_id] = {
              concept_id,
              labels: [],
              start,
              end,
              biolink_types: [],
              entries: [],
              entry_titles: [],
              annotations: [],
            };
          }
          if (!(biolink_type in concepts.value[concept_id].biolink_types)) {
            concepts.value[concept_id].biolink_types.push(biolink_type);
          }
          if (!(label in concepts.value[concept_id].labels)) {
            concepts.value[concept_id].labels.push(label);
          }
          if (!(entry.title in concepts.value[concept_id].entry_titles)) {
            concepts.value[concept_id].entry_titles.push(entry.title);
          }
          concepts.value[concept_id].entries.push(entry);
          concepts.value[concept_id].annotations.push(annotation);
        }
      }
    }

    return acc;
  }, {});

  annotatedTextByAnnotationsDescending.value = Object.values(annotatedTextByTitle.value).sort((a, b) => b.annotations.length - a.annotations.length);

  // Ready to go!
  loaded.value = true;
});

function uniqList(list: string[]) {
  return [...new Set(list)];
}

function conceptsForEntryTitle(entry_title: string) {
  return Object.values(concepts.value).filter(concept => concept.entry_titles.includes(entry_title));
}

function conceptsSortedByEntryCountDescending() {
  return Object.values(concepts.value)
      .map(data => ({...data, biolink_type: uniqList(data.biolink_types)[0], entry_count: data.entries.length}))
      .sort((a, b) => b.entry_count - a.entry_count);
}

</script>

<template>
  <h2>Test</h2>


  <div class="accordion" id="accordionExample">
    <div class="accordion-item">
      <h2 class="accordion-header">
        <button class="accordion-button" type="button" data-bs-toggle="collapse" data-bs-target="#collapseOne" aria-expanded="true" aria-controls="collapseOne">
          Accordion Item #1
        </button>
      </h2>
      <div id="collapseOne" class="accordion-collapse collapse show" data-bs-parent="#accordionExample">
        <div class="accordion-body">
          <strong>This is the first item’s accordion body.</strong> It is shown by default, until the collapse plugin adds the appropriate classes that we use to style each element. These classes control the overall appearance, as well as the showing and hiding via CSS transitions. You can modify any of this with custom CSS or overriding our default variables. It’s also worth noting that just about any HTML can go within the <code>.accordion-body</code>, though the transition does limit overflow.
        </div>
      </div>
    </div>
    <div class="accordion-item">
      <h2 class="accordion-header">
        <button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#collapseTwo" aria-expanded="false" aria-controls="collapseTwo">
          Accordion Item #2
        </button>
      </h2>
      <div id="collapseTwo" class="accordion-collapse collapse" data-bs-parent="#accordionExample">
        <div class="accordion-body">
          <strong>This is the second item’s accordion body.</strong> It is hidden by default, until the collapse plugin adds the appropriate classes that we use to style each element. These classes control the overall appearance, as well as the showing and hiding via CSS transitions. You can modify any of this with custom CSS or overriding our default variables. It’s also worth noting that just about any HTML can go within the <code>.accordion-body</code>, though the transition does limit overflow.
        </div>
      </div>
    </div>
    <div class="accordion-item">
      <h2 class="accordion-header">
        <button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#collapseThree" aria-expanded="false" aria-controls="collapseThree">
          Accordion Item #3
        </button>
      </h2>
      <div id="collapseThree" class="accordion-collapse collapse" data-bs-parent="#accordionExample">
        <div class="accordion-body">
          <strong>This is the third item’s accordion body.</strong> It is hidden by default, until the collapse plugin adds the appropriate classes that we use to style each element. These classes control the overall appearance, as well as the showing and hiding via CSS transitions. You can modify any of this with custom CSS or overriding our default variables. It’s also worth noting that just about any HTML can go within the <code>.accordion-body</code>, though the transition does limit overflow.
        </div>
      </div>
    </div>
  </div>
  
  <h2>Texts</h2>
  <template v-if="loaded">
    <div class="accordion" id="accordionTexts">
      <div class="accordion-item" v-for="(annotatedText, index) in annotatedTextByAnnotationsDescending" :key="annotatedText.title">
        <h2 class="accordion-header">
          <button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" :data-bs-target="'#collapseText' + index" aria-expanded="false" :aria-controls="'collapseText' + index">
            <code>{{annotatedText.title}}</code>
            {{annotatedText.annotations.length}} total annotations
          </button>
        </h2>
        <div :id="'collapseText' + index" class="accordion-collapse collapse" data-bs-parent="#accordionTexts">
          <div class="accordion-body">
            <ol>
              <li v-for="concept in conceptsForEntryTitle(annotatedText.title)" :key="concept.concept_id">
                <code>{{concept.concept_id}}</code> ({{uniqList(concept.labels).join(', ')}}) [{{uniqList(concept.biolink_types).join(', ')}}]: ({{concept.start}}-{{concept.end}})
              </li>
            </ol>
          </div>
        </div>
      </div>
    </div>

    <h2>Concepts</h2>
    <ol>
      <li v-for="concept in conceptsSortedByEntryCountDescending()" :key="concept.concept_id">
        <code>{{concept.concept_id}}</code> ({{uniqList(concept.labels).join(', ')}}, {{concept.entry_count}} entries)
      </li>
    </ol>
  </template>
  <div v-else>
    <p>Loading...</p>
  </div>
</template>

<style>
</style>
