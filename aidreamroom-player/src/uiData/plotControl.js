import { ref } from 'vue';
import { PLOT_ITEM_TYPE } from '../constant'

const preCondition = { title: '其他先决条件', bgImage: '/public/assets/bg_plot_condition.png', value: [], enbaleImport: false, type: PLOT_ITEM_TYPE.CONDITION }
const plotBranch = { title: '剧情分支', bgImage: '/public/assets/bg_plot_branch.png', value: [], enbaleImport: false, type: PLOT_ITEM_TYPE.BRANCH }
const time = { title: '时间', bgImage: '/public/assets/bg_time.png', value: [], enbaleImport: false, type: PLOT_ITEM_TYPE.TIME }
const place = { title: '地点', bgImage: '/public/assets/bg_place.png', value: [], enbaleImport: true, type: PLOT_ITEM_TYPE.PLACE }
const character = { title: '人物', bgImage: '/public/assets/bg_plot_chacater.png', value: [], enbaleImport: true, type: PLOT_ITEM_TYPE.CHACATER }
export const cardInfo = ref([
    plotBranch,
    preCondition,
    time,
    place,
    character
])
export let totalPlotItemList = [];
export const setTotalPlotItemList = (list) => {
    totalPlotItemList = list;
}
export let defaultItem = null
export const clearCardInfo = () => {
    for (const item of cardInfo.value) {
        item['value'] = [];
    }
}
export const setPlotDefaultItem = (item) => {
    defaultItem = !item ? null : { ...item };
}
export const addItem = (_item, type) => {
    console.log('addItem', type, _item);
    for (const item of cardInfo.value) {
        console.log(item.type)
        if (item.type === type) {
            console.log(item['value']);
            item['value'].push(_item);
        }
    }
    totalPlotItemList.push(_item);
    console.log(cardInfo.value);
}
export const removeItem = (uuid, type) => {
    console.log('removeItem', uuid, type)
    for (const item of cardInfo.value) {
        if (item.type === type) {
            for (let i = 0; i < item.value.length; i++) {
                if (item.value[i].uuid === uuid) {
                    item.value.splice(i, 1);
                    console.log(item);
                }
            }
        }
    }
    for (const item of totalPlotItemList) {
        if (item.uuid === uuid) {
            totalPlotItemList.splice(i, 1);
        }
    }
}
export const editItem = (_item, type) => {
    console.log('addItem', type, _item);

    for (const item of cardInfo.value) {
        if (item.type === type) {
            for (let i = 0; i < item.value.length; i++) {
                if (item.value[i].uuid == _item.uuid) {
                    console.log('edit', _item);
                    item.value[i] = _item
                }
            }
        }
    }
}