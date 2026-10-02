# The tab search service on its own, for hosting it behind a domain:
#   docker build -t tab-search server
#   docker run -p 8787:8787 -e ALLOWED_ORIGINS=https://player.example.com tab-search
# then point the app at it with VITE_TAB_SEARCH_URL=https://tabs.example.com.
FROM node:22-alpine
WORKDIR /app
# No dependencies: Node 22 runs the TypeScript source directly.
COPY . server/
ENV HOST=0.0.0.0 PORT=8787
EXPOSE 8787
USER node
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://127.0.0.1:8787/api/tabs/health || exit 1
CMD ["node", "server/main.ts"]
