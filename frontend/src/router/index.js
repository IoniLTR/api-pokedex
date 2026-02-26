import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'
import LoginView from '../views/LoginView.vue'
import RegisterView from '../views/RegisterView.vue'
import ProfileView from '../views/ProfileView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: HomeView,
    },
    {
      path: '/connexion',
      name: 'connexion',
      component: LoginView
    },
    {
      path: '/inscription',
      name: 'inscription',
      component: RegisterView
    },
    {
      path: '/profil',
      name: 'profil',
      component: ProfileView
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
