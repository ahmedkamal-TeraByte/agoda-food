import { createRouter, createWebHistory } from 'vue-router'
import { useUserStore } from '../stores/user'
import HomePage from '../pages/HomePage.vue'
import RestaurantPage from '../pages/RestaurantPage.vue'
import CartPage from '../pages/CartPage.vue'
import OrderSuccessPage from '../pages/OrderSuccessPage.vue'
import LoginPage from '../pages/LoginPage.vue'
import LineCallbackPage from '../pages/LineCallbackPage.vue'
import OnboardingPage from '../pages/OnboardingPage.vue'
import ProfilePage from '../pages/ProfilePage.vue'
import OrdersPage from '../pages/OrdersPage.vue'

export const router = createRouter({
  history: createWebHistory(),
  scrollBehavior: () => ({ top: 0 }),
  routes: [
    { path: '/', component: HomePage },
    { path: '/restaurant/:id', component: RestaurantPage },
    { path: '/cart', component: CartPage },
    { path: '/order/:id', component: OrderSuccessPage },
    { path: '/login', component: LoginPage },
    { path: '/auth/line/callback', component: LineCallbackPage },
    { path: '/onboarding', component: OnboardingPage },
    { path: '/profile', component: ProfilePage },
    { path: '/orders', component: OrdersPage },
  ],
})

// Routes where an incomplete profile blocks access.
const ONBOARDING_GATED = ['/cart', '/profile', '/orders']

router.beforeEach((to) => {
  // Pinia is initialised before the router so we can safely call useUserStore here.
  const user = useUserStore()

  // Logged-in users with incomplete profiles get redirected to onboarding
  // when trying to reach gated routes.
  if (
    user.isLoggedIn &&
    user.needsOnboarding &&
    ONBOARDING_GATED.includes(to.path) &&
    to.path !== '/onboarding'
  ) {
    return { path: '/onboarding', query: { redirect: to.fullPath } }
  }
})
