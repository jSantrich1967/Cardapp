# Recuperar datos perdidos

Si cambiaste de proyecto Supabase o la base de datos está vacía, sigue estos pasos:

## 1. Crear las tablas

**Opción A - Desde la terminal:**
```bash
npm run db:run-migrations
```

**Opción B - Desde Supabase Dashboard:**
1. Entra a [Supabase Dashboard](https://supabase.com/dashboard) → tu proyecto
2. Ve a **SQL Editor**
3. Copia el contenido de `drizzle/schema-completo.sql`
4. Pégalo y haz clic en **Run**

Si aparece "ya existe", usa `drizzle/schema-solo-tablas.sql` en su lugar.

## 2. Restaurar desde respaldo (si tienes uno)

Si exportaste un respaldo antes:

1. En la app, ve a **Respaldo**
2. Haz clic en **Seleccionar archivo** y elige tu archivo `.json`
3. Haz clic en **Importar respaldo**
4. Confirma

## 3. Si no tienes respaldo

Tendrás que volver a agregar los datos manualmente:

- **Tarjetas**: Crea las tarjetas en la página Tarjetas
- **Transacciones**: Agrégalas manualmente o importa desde imágenes (Importar)

## 4. Probar con datos de ejemplo

Hay un `backup.json` en el proyecto con datos de prueba. Puedes importarlo desde la página Respaldo para verificar que todo funciona.
