#!/bin/sh
# Confere se os sistemas estão no ar e mostra o fim do log do atendente.
for p in 4321 3300 3210 4402 4403 4404; do
  echo "$p $(curl -s -o /dev/null -w '%{http_code}' --max-time 5 http://localhost:$p/)"
done
tail -n "${1:-15}" /c/LED-atendente/servidor.log
