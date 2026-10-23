FROM nginx:1.29-alpine
ENV NGINX_ENTRYPOINT_LOCAL_RESOLVERS=1
COPY nginx.conf /etc/nginx/templates/default.conf.template
COPY dist /usr/share/nginx/html
EXPOSE 8080
