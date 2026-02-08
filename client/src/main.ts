import { createApp } from "vue";
// 引入 Vue Data UI 及其样式
import { VueDataUi } from "vue-data-ui";
import "vue-data-ui/style.css";
import "./style.css";
import App from "./App.vue";

const app = createApp(App);
app.component("VueDataUi", VueDataUi);

app.mount("#app");
