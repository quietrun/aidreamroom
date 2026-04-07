import { toRefs, defineProps, ref } from 'vue';
import { setDefaultItem } from './outlookControl';
import { setPlotDefaultItem } from './plotControl';

let editOutlookItemId = '';
let editOutlookId = '';
let editOutlookType = 0;
export let currentOutlookId = '';
const setCurrentOutlookId = (id) => {
    currentOutlookId = id;
}
const enableShowEditOutlookItemDialog = ref(false);
const enableShowEditOutlookDialog = ref(false);
const editOutlookItemDialogTitle = ref('');
const editOutlookDialogTitle = ref('');

const showEditOutlookItemDialog = (title, itemId, type, defaultItem = null) => {
    enableShowEditOutlookItemDialog.value = true;
    editOutlookItemDialogTitle.value = title;
    editOutlookItemId = itemId;
    editOutlookId = currentOutlookId;
    editOutlookType = type;
    console.log('showEditOutlookItemDialog', defaultItem)
    setDefaultItem(defaultItem);
}
const closeEditOutlookItemDialog = () => {
    enableShowEditOutlookItemDialog.value = false;
    editOutlookItemDialogTitle.value = '';
    editOutlookItemId = '';
    editOutlookId = '';
    editOutlookType = 0;
}
const showEditOutlookDialog = (id, title) => {
    enableShowEditOutlookDialog.value = true;
    editOutlookId = id;
    editOutlookDialogTitle.value = id ? title : '新的世界观'
}
const closeEditOutlookDialog = () => {
    enableShowEditOutlookDialog.value = false;
}

let editPlotItemId = '';
let editPlotId = '';
let editPlotType = 0;
let selectPlot = '';
let editPlotDescript = '';
let editPlotWorldType = '';
export let currentPlotId = '';
const setCurrentPlotId = (id) => {
    currentPlotId = id;
}
const enableShowEditPlotItemDialog = ref(false);
const enableShowEditPlotDialog = ref(false);
const editPlotItemDialogTitle = ref('');
const editPlotDialogTitle = ref('');

const showEditPlotItemDialog = (title, itemId, type, defaultItem = null) => {
    enableShowEditPlotItemDialog.value = true;
    editPlotItemDialogTitle.value = title;
    editPlotItemId = itemId;
    editPlotId = currentPlotId;
    editPlotType = type;
    console.log('showEditPlotItemDialog', defaultItem)
    setPlotDefaultItem(defaultItem);
}
const closeEditPlotItemDialog = () => {
    enableShowEditPlotItemDialog.value = false;
    editPlotItemDialogTitle.value = '';
    editPlotItemId = '';
    editPlotId = '';
    editPlotType = 0;
}
const showEditPlotDialog = (id, title, descript, worldType) => {
    enableShowEditPlotDialog.value = true;
    editPlotId = id;
    editPlotDescript = descript ?? ''
    editPlotWorldType = worldType ?? ''
    editPlotDialogTitle.value = id ? title : '新的剧情'
}
const closeEditPlotDialog = () => {
    enableShowEditPlotDialog.value = false;
}
const setPlotItem = (item) => {
    selectPlot = item
}
export {
    editOutlookItemId,
    setCurrentOutlookId,
    selectPlot,
    editOutlookId,
    editOutlookType,
    enableShowEditOutlookItemDialog,
    editOutlookItemDialogTitle,
    closeEditOutlookDialog,
    showEditOutlookItemDialog,
    closeEditOutlookItemDialog,
    showEditOutlookDialog,
    enableShowEditOutlookDialog,
    editOutlookDialogTitle,

    editPlotItemId,
    setCurrentPlotId,
    editPlotId,
    editPlotType,
    enableShowEditPlotItemDialog,
    editPlotItemDialogTitle,
    closeEditPlotDialog,
    showEditPlotItemDialog,
    closeEditPlotItemDialog,
    showEditPlotDialog,
    enableShowEditPlotDialog,
    editPlotDialogTitle,
    setPlotItem,

    editPlotDescript,
    editPlotWorldType,
};