import { createRouter, createWebHistory } from 'vue-router'
import { useUserStore } from '../stores/user'
import HomePage from '../pages/HomePage.vue'
import RestaurantPage from '../pages/RestaurantPage.vue'
import CartPage from '../pages/CartPage.vue'
import CheckoutPage from '../pages/CheckoutPage.vue'
import OrderSuccessPage from '../pages/OrderSuccessPage.vue'
import LoginPage from '../pages/LoginPage.vue'
import LineCallbackPage from '../pages/LineCallbackPage.vue'
import OnboardingPage from '../pages/OnboardingPage.vue'
import ProfilePage from '../pages/ProfilePage.vue'
import OrdersPage from '../pages/OrdersPage.vue'
import RestaurantApplyPage from '../pages/RestaurantApplyPage.vue'
import MerchantSettings from '../pages/MerchantSettings.vue'
import MerchantMenu from '../pages/MerchantMenu.vue'
import MerchantCategories from '../pages/MerchantCategories.vue'
import MerchantOrders from '../pages/MerchantOrders.vue'

export const router = createRouter({
  history: createWebHistory(),
  scrollBehavior: () => ({ top: 0 }),
  routes: [
    { path: '/', component: HomePage },
    { path: '/restaurant/:id', component: RestaurantPage },
    { path: '/cart', component: CartPage },
    { path: '/checkout', component: CheckoutPage, meta: { requiresAuth: true } },
    { path: '/order/:id', component: OrderSuccessPage, meta: { requiresAuth: true } },
    { path: '/login', component: LoginPage },
    { path: '/auth/line/callback', component: LineCallbackPage },
    { path: '/onboarding', component: OnboardingPage },
    { path: '/profile', component: ProfilePage },
    { path: '/orders', component: OrdersPage },
    { path: '/restaurants/apply', component: RestaurantApplyPage, meta: { requiresAuth: true } },
    { path: '/merchant', redirect: '/merchant/orders' },
    { path: '/merchant/orders', component: MerchantOrders, meta: { requiresMerchant: true } },
    { path: '/merchant/menu', component: MerchantMenu, meta: { requiresMerchant: true } },
    { path: '/merchant/categories', component: MerchantCategories, meta: { requiresMerchant: true } },
    { path: '/merchant/settings', component: MerchantSettings, meta: { requiresMerchant: true } },
  ],
})

router.beforeEach((to) => {
  const user = useUserStore()

  if (to.meta.requiresMerchant) {
    if (!user.isLoggedIn) {
      return { path: '/login', query: { redirect: to.fullPath } }
    }
    if (!user.isMerchant) {
      return { path: '/' }
    }
  }

  if (to.meta.requiresAuth && !user.isLoggedIn) {
    return { path: '/login', query: { redirect: to.fullPath } }
  }
})
