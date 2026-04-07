import { ref } from 'vue';
import { OUTLOOK_ITEM_TYPE } from '../constant'
export const cardInfo = ref([
    { title: '地点', bgImage: '/public/assets/bg_place.png', value: [], enbaleImport: false, type: OUTLOOK_ITEM_TYPE.PLACE },
    { title: '种族', bgImage: '/public/assets/bg_race.png', value: [], enbaleImport: false, type: OUTLOOK_ITEM_TYPE.RACE },
    { title: '人物', bgImage: '/public/assets/bg_chacater_outlook.png', value: [], enbaleImport: true, type: OUTLOOK_ITEM_TYPE.CHACATER },
    { title: '专有名词', bgImage: '/public/assets/bg_word.png', value: [], enbaleImport: false, type: OUTLOOK_ITEM_TYPE.KEYWORD },
    { title: '物品', bgImage: '/public/assets/bg_item.png', value: [], enbaleImport: false, type: OUTLOOK_ITEM_TYPE.ITEM },
    { title: '能力体系', bgImage: '/public/assets/bg_ability.png', value: [], enbaleImport: false, type: OUTLOOK_ITEM_TYPE.ABILITY },
])
export let defaultItem = null
export const clearCardInfo = () => {
    for (const item of cardInfo.value) {
        item['value'] = [];
    }
}
export const setDefaultItem = (item) => {
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