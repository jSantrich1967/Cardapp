# Reglas de negocio - CardOps

## Convención de signos para montos

Las transacciones afectan el saldo según su tipo:

| Tipo | Efecto | Almacenamiento |
|------|--------|-----------------|
| **RECARGA** | Suma al saldo | Monto positivo |
| **PROCESADA** | Resta del saldo | Monto negativo |
| **FEE_VZLA** | Resta del saldo | Monto negativo |
| **FEE_MERCHANT** | Resta del saldo | Monto negativo |

**Saldo =** suma de todos los montos (positivos suman, negativos restan).

## Fees automáticos

- Al crear una **PROCESADA**, se generan automáticamente:
  - **FEE_VZLA** = 1.5% del monto
  - **FEE_MERCHANT** = 1% del monto
- Ambos se guardan como montos negativos.
