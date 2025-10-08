<script setup lang="ts">
import {fetchAssingments, type Assingments} from './utils/assingments';

const url = ref('https://wol.jw.org/es/wol/library/r4/lp-s/biblioteca/gu%C3%ADa-de-actividades/gu%C3%ADa-de-actividades-2025/noviembre')
const assingments = useLocalStorage<Assingments[]>("assingments", [])

function fetchAllAssingments() {
    if (!url.value) return
    fetchAssingments(url.value).then(data => {
        assingments.value = data
    })
}
</script>

<template>
    <div class="dont-print p-4 flex gap-2">
        <PrintableInput v-model="url" />
        <Button @click="fetchAllAssingments">
            Click me
        </Button>
    </div>
    <div v-for="assingment in assingments" class="dont-break mb-8">
        <table class="w-full border-collapse">
            <tbody>
                <tr>
                    <td class="font-bold text-lg" colspan="2">{{assingment.date}} | {{assingment.assignedReading}}</td>
                    <td class="text-right pr-2">Presidente:</td>
                    <td><input type="text" class="editable" value="Abner Samayoa"></td>
                </tr>
                <tr>
                    <td class="py-1" colspan="4">● Canción 131 y oración</td>
                </tr>
                <tr>
                    <td class="py-1" colspan="4">● Palabras de introducción (1 min.)</td>
                </tr>
                <tr>
                    <td class="bg-gray-700 text-white font-bold p-1" colspan="4">TESOROS DE LA BIBLIA</td>
                </tr>
                <tr>
                    <td class="py-1" colspan="2">● Fortalezcan su cuerda triple (10 mins.)</td>
                    <td colspan="2"><input type="text" class="editable" value="Jonathan Morales"></td>
                </tr>
                <tr>
                    <td class="py-1" colspan="2">● Busquemos perlas escondidas (10 mins.)</td>
                    <td colspan="2"><input type="text" class="editable" value="Chris Escobar"></td>
                </tr>
                <tr>
                    <td class="py-1">● Lectura de la Biblia (4 mins.)</td>
                    <td class="text-right pr-2">Estudiante:</td>
                    <td colspan="2"><input type="text" class="editable" value="Edgar Alvarez"></td>
                </tr>

                <!-- Seamos Mejores Maestros -->
                <tr>
                    <td class="bg-amber-600 text-white font-bold p-1 mt-2" colspan="4">SEAMOS MEJORES MAESTROS</td>
                </tr>
                <!-- ===== CAMBIO A DROPDOWN AQUÍ ===== -->
                <tr>
                    <td class="py-1">● Empiece conversaciones (3 mins.)</td>
                    <td class="text-right pr-2">
                        <select class="editable-select">
                            <option selected>Estudiante/Ayudante:</option>
                            <option>Estudiante:</option>
                        </select>
                    </td>
                    <td colspan="2"><input type="text" class="editable" value="Lourdes Coronado/Ada Gonzales"></td>
                </tr>
                <tr>
                    <td class="py-1">● Haga revisitas (4 mins.)</td>
                    <td class="text-right pr-2">
                        <select class="editable-select">
                            <option selected>Estudiante/Ayudante:</option>
                            <option>Estudiante:</option>
                        </select>
                    </td>
                    <td colspan="2"><input type="text" class="editable" value="Alisson Garcia/Sofia Oscar"></td>
                </tr>
                <tr>
                    <td class="py-1">● Discurso (5 mins.)</td>
                    <td class="text-right pr-2">
                        <select class="editable-select">
                            <option>Estudiante/Ayudante:</option>
                            <option selected>Estudiante:</option>
                        </select>
                    </td>
                    <td colspan="2"><input type="text" class="editable" value="Marco Morales"></td>
                </tr>

                <!-- ... resto de las secciones ... -->
                <!-- Nuestra Vida Cristiana -->
                <tr>
                    <td class="bg-red-800 text-white font-bold p-1 mt-2" colspan="4">NUESTRA VIDA CRISTIANA</td>
                </tr>
                <tr>
                    <td class="py-1" colspan="4">● Canción 131</td>
                </tr>
                <tr>
                    <td class="py-1" colspan="2">● Cuando tengan problemas en su matrimonio... (15 mins.)</td>
                    <td colspan="2"><input type="text" class="editable" value="Ruben Prado"></td>
                </tr>
                <tr>
                    <td class="py-1">● Estudio bíblico de la congregación (30 mins.)</td>
                    <td class="text-right pr-2">Conductor/Lector:</td>
                    <td colspan="2"><input type="text" class="editable" value="Rony Reyes/Pablo Sanchez"></td>
                </tr>
                <!-- Conclusión -->
                <tr>
                    <td class="py-1" colspan="4">● Palabras de conclusión (3 mins.)</td>
                </tr>
                <tr>
                    <td class="py-1">● Canción 51</td>
                    <td class="text-right pr-2">Oración:</td>
                    <td colspan="2"><input type="text" class="editable" value="Francisco Tupas"></td>
                </tr>

            </tbody>
        </table>
    </div>
</template>
