<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import AppHeader from '../components/AppHeader.vue'

interface FaqItem {
  q: string
  a: string
}

interface FaqGroup {
  title: string
  items: FaqItem[]
}

interface FaqTab {
  key: 'customer' | 'merchant'
  label: string
  icon: string
  blurb: string
  groups: FaqGroup[]
}

const router = useRouter()
const activeTab = ref<'customer' | 'merchant'>('customer')
const openKey = ref<string | null>(null)

function toggle(key: string) {
  openKey.value = openKey.value === key ? null : key
}

const tabs: FaqTab[] = [
  {
    key: 'customer',
    label: 'For Customers',
    icon: '🍜',
    blurb: 'Ordering lunch, paying with PromptPay, and tracking your order.',
    groups: [
      {
        title: 'Getting started',
        items: [
          {
            q: 'What is Agoda Food and who can use it?',
            a: 'Agoda Food is a lunch-ordering app built for the Agoda Bangkok office. Anyone with a LINE account can browse and order; some merchant features require an Agoda email referral.',
          },
          {
            q: 'Do I need a LINE account to order?',
            a: 'Yes. We use Login with LINE for authentication, both in your browser and inside the LINE app via LIFF.',
          },
          {
            q: 'What is the difference between using the app inside LINE and in my browser?',
            a: 'Functionally they are the same. Inside LINE (LIFF) you are logged in automatically and the bot can push status updates straight to your chat. In an external browser you click "Login with LINE" and the JWT is stored locally.',
          },
          {
            q: 'Why am I asked for my email and phone after logging in?',
            a: 'LINE never gives us your phone number and not always your email. We need both to contact you about your order, so first-time users are sent to a short onboarding step.',
          },
        ],
      },
      {
        title: 'Browsing & ordering',
        items: [
          {
            q: 'How do I find restaurants that are open right now?',
            a: 'The home page lists all restaurants. Closed restaurants are marked clearly, and you can search by name, cuisine, or tag.',
          },
          {
            q: 'Can I order from more than one restaurant in the same cart?',
            a: 'No. Each cart belongs to one restaurant. Adding an item from a different restaurant will prompt you to clear your existing cart first.',
          },
          {
            q: 'How do I customize a dish?',
            a: 'On the dish card, set the quantity and add any special notes (e.g. "no chili"). The notes are passed through to the merchant on the order.',
          },
          {
            q: 'What happens if an item goes out of stock after I add it to the cart?',
            a: 'The merchant can mark items as unavailable. If that happens before you pay, you will see an error at checkout and can remove the item; if it happens after, the merchant will contact you or reject the order with a refund.',
          },
          {
            q: 'Where do I pick up my order?',
            a: 'Pickup details (where and when) are shown on each restaurant page and on the order receipt. Most restaurants deliver to a central pickup point in the office at lunch time.',
          },
        ],
      },
      {
        title: 'Payment',
        items: [
          {
            q: 'How does PromptPay payment work?',
            a: 'Every restaurant uploads their own PromptPay QR during setup. When you check out, we render their QR for the exact order amount — you scan it with your bank app and pay the merchant directly. No third-party payment processor is involved.',
          },
          {
            q: 'Do I need to upload a payment slip?',
            a: 'Yes. After paying, upload a screenshot of your transfer slip on the order page. The merchant manually verifies it before they start preparing your food — that\'s how we confirm the money landed in their account.',
          },
          {
            q: 'How long does payment confirmation take?',
            a: 'It depends on the merchant. Most verify proofs within a few minutes during lunch hours, either from the merchant dashboard or directly from the LINE bot.',
          },
          {
            q: 'What if the merchant rejects my payment proof?',
            a: 'You\'ll get a LINE notification. You can re-upload a clearer screenshot, or cancel the order and contact the merchant if the money has already left your account.',
          },
          {
            q: 'Can I get a refund if my order is rejected or cancelled?',
            a: 'Because money moves directly between you and the merchant, the app cannot issue an automatic refund. If a refund is needed, email the Agoda Food maintainer (Ahmed Kamal, ahmed.arshad@agoda.com) and we will coordinate with the restaurant.',
          },
        ],
      },
      {
        title: 'Order tracking',
        items: [
          {
            q: 'How will I know when my order is accepted, ready, or cancelled?',
            a: 'You will get a push notification in the Agoda Food LINE chat at each status change. The order page also updates in real time when you have it open.',
          },
          {
            q: 'Where do I see my current and past orders?',
            a: 'Open the menu in the top right and go to "My orders". You can also reopen any past receipt from there.',
          },
          {
            q: 'Can I cancel an order after placing it?',
            a: 'You can cancel while the order is still pending. Once the merchant has accepted and started preparing, you will need to contact them directly.',
          },
          {
            q: 'Why didn\'t I get a LINE notification?',
            a: 'Make sure you have added the Agoda Food bot as a friend in LINE and have not blocked the channel. If you log in only via an external browser, push notifications won\'t reach you until you connect your LINE chat.',
          },
        ],
      },
      {
        title: 'Account & help',
        items: [
          {
            q: 'How do I update my name, email, or phone?',
            a: 'Open the menu in the top right → Profile. Changes are saved immediately.',
          },
          {
            q: 'How do I log out?',
            a: 'Profile menu → Log out. Inside the LINE app, log-out is hidden because LIFF will sign you back in on the next reload — that is by design.',
          },
          {
            q: 'Who do I contact if something is wrong with my order or payment?',
            a: 'Email the Agoda Food maintainer at ahmed.arshad@agoda.com (Ahmed Kamal) — for both order/payment issues and bugs in the app — and we will follow up with the restaurant if needed.',
          },
        ],
      },
    ],
  },
  {
    key: 'merchant',
    label: 'For Restaurants',
    icon: '🏪',
    blurb: 'Listing your restaurant, managing your menu and orders, and getting paid.',
    groups: [
      {
        title: 'Applying & onboarding',
        items: [
          {
            q: 'Who can open a restaurant on Agoda Food?',
            a: 'Any restaurant that wants to serve the Agoda Bangkok office. You will need an Agoda employee to refer you by email so we can verify the request.',
          },
          {
            q: 'How do I apply?',
            a: 'Go to "Open a restaurant" in the profile menu (you must be logged in with LINE first). Fill in the form and provide the referring Agoda employee\'s email.',
          },
          {
            q: 'Why do I need an Agoda email as a referral?',
            a: 'Lunch ordering is for the Agoda office, so every restaurant must be vouched for by an Agoda employee. We send a one-time code to their @agoda.com address; the restaurant is only created after they enter that code.',
          },
          {
            q: 'What if the OTP email never arrives?',
            a: 'Check the spam folder first. If it is still missing, re-submit the application — the OTP is regenerated each time. We do not persist drafts, so an abandoned application leaves nothing behind.',
          },
          {
            q: 'How will I know I have been approved?',
            a: 'As soon as the OTP is verified your restaurant is created and your account is promoted to the merchant role. You will see a "Merchant dashboard" link in the profile menu.',
          },
        ],
      },
      {
        title: 'Merchant dashboard',
        items: [
          {
            q: 'How do I access the merchant dashboard?',
            a: 'Profile menu → Merchant dashboard, or go to /merchant. The dashboard has four tabs: Orders, Menu, Categories, Settings.',
          },
          {
            q: 'Can multiple staff share one merchant account?',
            a: 'Today the merchant role is tied to a single LINE account. Use a shared LINE account if multiple staff need access. Multi-user support is on the roadmap.',
          },
        ],
      },
      {
        title: 'Menu & categories',
        items: [
          {
            q: 'How do I add or edit a dish?',
            a: 'Merchant dashboard → Menu → "Add item" (or click an existing dish). You can set name, description, price, category, and a photo.',
          },
          {
            q: 'How do I organize dishes into categories?',
            a: 'Merchant dashboard → Categories. Create the categories first, then assign them when adding or editing each menu item.',
          },
          {
            q: 'How do I upload photos for my restaurant cover, logo, and dishes?',
            a: 'Use the image picker on the relevant edit form. Photos go to Cloudflare R2 (or to a local folder during development) and a public URL is stored on the record.',
          },
          {
            q: 'How do I temporarily mark a dish as out-of-stock?',
            a: 'On the menu item, toggle availability off. The dish stays in your menu but customers cannot add it to their cart.',
          },
          {
            q: 'How do I change prices, and does that affect existing orders?',
            a: 'Price changes apply to new orders only. Orders already placed keep the price the customer paid.',
          },
        ],
      },
      {
        title: 'Restaurant settings',
        items: [
          {
            q: 'How do I set opening hours and pickup time?',
            a: 'Merchant dashboard → Settings. You can set per-day hours and the cut-off time after which new orders are blocked.',
          },
          {
            q: 'How do I temporarily close my restaurant?',
            a: 'Toggle "Accepting orders" off in Settings. Existing orders are unaffected; new orders are blocked until you turn it back on.',
          },
          {
            q: 'How do I update my restaurant name, description, or contact info?',
            a: 'Merchant dashboard → Settings. Changes are reflected on the customer-facing page immediately after save.',
          },
        ],
      },
      {
        title: 'Orders',
        items: [
          {
            q: 'How am I notified about new orders?',
            a: 'You see them in the Orders tab of the merchant dashboard. If you have connected the LINE bot, you also get a push message in your LINE chat for each new order.',
          },
          {
            q: 'How do I move an order through its statuses?',
            a: 'From the Orders tab tap Accept → Preparing → Ready → Completed. You can Reject a pending order; refunds are then triggered automatically for Stripe-paid orders.',
          },
          {
            q: 'What if I cannot fulfill an order I already accepted?',
            a: 'Contact the customer directly using the phone number on the order, then cancel it from the dashboard so the customer is refunded.',
          },
        ],
      },
      {
        title: 'Payments',
        items: [
          {
            q: 'How do PromptPay payments reach my account?',
            a: 'Customers pay you directly: we re-render your uploaded PromptPay QR for each order and the money goes straight from their bank to yours. The app never holds or moves the funds.',
          },
          {
            q: 'How do I upload my PromptPay QR?',
            a: 'Merchant dashboard → Settings → PromptPay QR. Upload an image of your QR; we decode the EMV payload and store only that string (the image itself is discarded). You can replace it any time.',
          },
          {
            q: 'Why do I have to verify each payment manually?',
            a: 'Because we don\'t go through a payment processor, the app can\'t tell on its own whether the customer\'s transfer actually landed. You confirm against your bank app, then approve or reject the proof.',
          },
          {
            q: 'Where do I review customer payment proofs?',
            a: 'On the order in the Orders tab. The proof image is fetched via a signed URL from our private R2 bucket so only you and the customer can see it.',
          },
          {
            q: 'Can I approve or reject payment proofs from inside LINE?',
            a: 'Yes. The bot sends a Flex message with Approve / Reject buttons when a customer uploads a proof, so you can act on it without opening the dashboard.',
          },
          {
            q: 'What happens when I reject a payment proof?',
            a: 'The order moves to a payment-rejected state and the customer is notified in LINE that they need to re-upload or contact you. Refunds (if money was actually sent) are arranged directly with the customer.',
          },
        ],
      },
      {
        title: 'LINE bot & help',
        items: [
          {
            q: 'How do I connect my LINE account to my merchant account?',
            a: 'Add the Agoda Food bot as a friend in LINE. As long as you log into the dashboard with the same LINE account, merchant notifications will flow to that chat.',
          },
          {
            q: 'Why am I not getting LINE notifications for new orders?',
            a: 'Check that you have not blocked the Agoda Food channel and that your merchant account\'s LINE user ID matches the one you have added the bot with. Re-logging in usually fixes it.',
          },
          {
            q: 'Who do I contact for technical issues or feature requests?',
            a: 'Email the Agoda Food maintainer Ahmed Kamal at ahmed.arshad@agoda.com. For urgent operational issues, you can also message the Agoda employee who referred your restaurant.',
          },
        ],
      },
    ],
  },
]
</script>

<template>
  <div class="min-h-screen bg-gray-50">
    <AppHeader />

    <div class="max-w-2xl mx-auto px-4 py-6">
      <div class="flex items-center gap-3 mb-2">
        <button @click="router.back()" class="text-brand-500 text-sm">← Back</button>
        <h1 class="font-bold text-gray-900 text-xl">Help &amp; FAQ</h1>
      </div>
      <p class="text-gray-500 text-sm mb-5">
        Everything you need to know about ordering, paying, and running a restaurant on Agoda Food.
      </p>

      <!-- Tabs -->
      <div
        class="grid grid-cols-2 bg-white rounded-2xl border border-gray-100 shadow-sm p-1 mb-5"
        role="tablist"
      >
        <button
          v-for="tab in tabs"
          :key="tab.key"
          role="tab"
          :aria-selected="activeTab === tab.key"
          class="flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors"
          :class="
            activeTab === tab.key
              ? 'bg-brand-500 text-white shadow-sm'
              : 'text-gray-600 hover:bg-gray-50'
          "
          @click="(activeTab = tab.key), (openKey = null)"
        >
          <span aria-hidden="true">{{ tab.icon }}</span>
          <span>{{ tab.label }}</span>
        </button>
      </div>

      <!-- Active tab content -->
      <template v-for="tab in tabs" :key="tab.key">
        <div v-if="activeTab === tab.key">
          <p class="text-sm text-gray-500 mb-4 px-1">{{ tab.blurb }}</p>

          <section
            v-for="(group, gi) in tab.groups"
            :key="group.title"
            class="mb-6"
          >
            <h2 class="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2 px-1">
              {{ group.title }}
            </h2>

            <div class="bg-white rounded-2xl border border-gray-100 shadow-sm divide-y divide-gray-100 overflow-hidden">
              <div
                v-for="(item, i) in group.items"
                :key="i"
              >
                <button
                  class="w-full flex items-center justify-between gap-3 text-left px-4 py-3.5 hover:bg-gray-50"
                  :aria-expanded="openKey === `${tab.key}-${gi}-${i}`"
                  @click="toggle(`${tab.key}-${gi}-${i}`)"
                >
                  <span class="text-sm font-medium text-gray-900">{{ item.q }}</span>
                  <span
                    class="text-gray-400 text-xs transition-transform shrink-0"
                    :class="openKey === `${tab.key}-${gi}-${i}` ? 'rotate-180' : ''"
                  >
                    ▼
                  </span>
                </button>
                <div
                  v-if="openKey === `${tab.key}-${gi}-${i}`"
                  class="px-4 pb-4 -mt-1 text-sm text-gray-600 leading-relaxed"
                >
                  {{ item.a }}
                </div>
              </div>
            </div>
          </section>
        </div>
      </template>

      <div class="mt-8 bg-white rounded-2xl border border-gray-100 shadow-sm p-4 text-center">
        <p class="text-sm font-semibold text-gray-900 mb-1">Still stuck?</p>
        <p class="text-xs text-gray-500 mb-3">
          Email the Agoda Food maintainer and we'll get back to you.
        </p>
        <a
          href="mailto:ahmed.arshad@agoda.com?subject=Agoda%20Food%20—%20Help"
          class="inline-flex items-center gap-2 bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium px-4 py-2 rounded-xl"
        >
          <span aria-hidden="true">✉️</span>
          <span>Ahmed Kamal · ahmed.arshad@agoda.com</span>
        </a>
      </div>
    </div>
  </div>
</template>
