import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
export default defineConfig({plugins:[react()],base:'/haitop-realty-system/ktop-diary/',build:{outDir:'../ktop-diary',emptyOutDir:true}})
