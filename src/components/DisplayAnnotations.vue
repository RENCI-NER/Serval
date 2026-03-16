<script setup lang="ts">
import "@ghentcdh/annotated-text/annotated-text.css";
import "bootstrap/js/dist/collapse";

import {computed, onMounted, ref} from "vue";
import {type Annotation, createAnnotatedText, getAnnotatedText, MarkdownTextAdapter} from "@ghentcdh/annotated-text";

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
const highlighted_annotation = ref({});

// UI modelled data.
const selectedTextID = ref("");

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

function selectText(id, annotatedText) {
  selectedTextID.value = annotatedText.title;

  const textAnnotation = createAnnotatedText(id, {
        annotation: {
          defaultRender: "underline",
          lineAdapter: MarkdownTextAdapter(),
          tagConfig: {
            enabled: true,
            tagFn: (annotation) => (annotation.biolink_type ?? "biolink:Entity").substring(8),
          },
        },
      })
      .setText(annotatedText.text)
      .setAnnotations(annotatedText.annotations)
      .on("mouse-enter", (event) => {
        const annotation = event.data.annotation as Annotation;
        getAnnotatedText(id).highlightAnnotations([
          annotation.id,
        ]);
        highlighted_annotation.value = annotation;
      });
}

const highlightedAnnotationJSON = computed (() => JSON.stringify(highlighted_annotation.value, null, 2));
const highlightedAnnotationProvenances = computed (() => {
  if (!highlighted_annotation.value) return [];

  const provenances = [];
  let recurseBasedOn = function(annotation: any) {
    if (annotation.provenance) provenances.push(annotation.provenance);
    if (annotation.based_on) {
      annotation.based_on.forEach(based_on_next => recurseBasedOn(based_on_next));
    }
  }
  recurseBasedOn(highlighted_annotation.value);

  return provenances;
});

function annotationsByProvenance(annotations: any[]) {
  return annotations.reduce((acc, annotation) => {
    const key = annotation.provenance.name;
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
}

</script>

<template>
  <h2>Texts</h2>
  <template v-if="loaded">
    <div class="card">
      <div class="card-body">
          <div class="row">
            <div class="col-2 overflow-auto" style="max-height: 100vh;">
              <div class="accordion" id="accordionTexts">
                <div class="accordion-item" v-for="(annotatedText, index) in annotatedTextByAnnotationsDescending" :key="annotatedText.title">
                  <h2 class="accordion-header">
                    <button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" :data-bs-target="'#collapseText' + index" aria-expanded="false" :aria-controls="'collapseText' + index" @click="selectText('annotatedTextComponent', annotatedText)">
                      <code>{{annotatedText.title}}</code>
                      {{annotatedText.annotations.length}} total annotations: {{annotationsByProvenance(annotatedText.annotations)}}
                    </button>
                  </h2>
                  <div :id="'collapseText' + index" class="accordion-collapse collapse" data-bs-parent="#accordionTexts">
                    <div class="accordion-body">
                      <p>Hmm.</p>
                      <!--
                      <ol>
                        <li v-for="concept in conceptsForEntryTitle(annotatedText.title)" :key="concept.concept_id">
                          <code>{{concept.concept_id}}</code> ({{uniqList(concept.labels).join(', ')}}) [{{uniqList(concept.biolink_types).join(', ')}}]
                        </li>
                      </ol>-->
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div class="col-5">
              <div class="card">
                <div class="card-header">
                  <h4>Annotated text</h4>
                </div>
                <div class="card-body">
                  <p v-if="!selectedTextID">Please select a text from the left.</p>
                  <div id="annotatedTextComponent" />
                </div>
              </div>
            </div>
            <div class="col-5">
              <div class="card sticky-top">
                <div class="card-header">
                  <h4>Selected annotation</h4>
                </div>
                <div class="card-body">
                  <form>
                    <div class="mb-3">
                      <label for="identifier" class="form-label">Text ID</label>
                      <input readonly type="text" class="form-control" id="identifier" v-model="selectedTextID" />
                    </div>
                    <template v-if="highlighted_annotation">
                      <div class="mb-3">
                        <label for="highlightedAnnotationText" class="form-label">Selected text</label>
                        <input readonly type="text" class="form-control" id="highlightedAnnotationText" v-model="highlighted_annotation.text" />
                      </div>
                      <div class="mb-3">
                        <label for="highlightedAnnotationProvenances" class="form-label">Provenances ({{highlightedAnnotationProvenances.length}}):</label>
                        <ol>
                          <li v-for="prov in highlightedAnnotationProvenances" :key="prov.url"><a :href="prov.url" target="_blank">{{prov.name}}</a> {{prov.version}}</li>
                        </ol>
                      </div>
                      <div class="mb-3">
                        <label for="highlightedAnnotationIdentifier" class="form-label">Identifier</label>
                        <input readonly type="text" class="form-control" id="highlightedAnnotationIdentifier" v-model="highlighted_annotation.id" />
                      </div>
                      <div class="mb-3">
                        <label for="highlightedAnnotationLabel" class="form-label">Label</label>
                        <input readonly type="text" class="form-control" id="highlightedAnnotationLabel" v-model="highlighted_annotation.label" />
                      </div>
                      <div class="mb-3">
                        <label for="highlightedAnnotationBiolinkType" class="form-label">Biolink type</label>
                        <input readonly type="text" class="form-control" id="highlightedAnnotationBiolinkType" v-model="highlighted_annotation.biolink_type" />
                      </div>
                      <!--
                      <div class="mb-3">
                        <label for="highlightedAnnotationJSON" class="form-label">Selected text</label>
                        <textarea readonly type="text" class="form-control" id="highlightedAnnotationJSON" v-model="highlightedAnnotationJSON" rows="100" />
                      </div> -->
                    </template>
                  </form>
                </div>
              </div>
            </div>
          </div>
      </div>
    </div>

    <!--
    <h2>Concepts</h2>
    <ol>
      <li v-for="concept in conceptsSortedByEntryCountDescending()" :key="concept.concept_id">
        <code>{{concept.concept_id}}</code> ({{uniqList(concept.labels).join(', ')}}, {{concept.entry_count}} entries)
      </li>
    </ol>-->
  </template>
  <div v-else>
    <p>Loading...</p>
  </div>
</template>

<style>
</style>
