import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: () => import('../views/HomeView.vue'),
    },
    {
      path: '/connexion',
      name: 'connexion',
      component: () => import('../views/LoginView.vue')
    },
    {
      path: '/inscription',
      name: 'inscription',
      component: () => import('../views/RegisterView.vue')
    },
    {
      path: '/profil',
      name: 'profil',
      component: () => import('../views/ProfileView.vue')
    },
    {
      path: '/login',
      redirect: '/connexion'
    },
    {
      path: '/register',
      redirect: '/inscription'
    }
  ]
})

export default router
