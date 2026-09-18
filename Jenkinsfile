pipeline {
    agent any
    tools {
        nodejs 'Node24'
    }
    environment {
        REGISTRY = 'ghcr.io'
        REGISTRY_NAMESPACE = 'sa3id-boubaker'
        KUBE_NAMESPACE = 'omarise'
    }
    stages {
        stage('Verify Environment') {
            steps {
                sh 'node -v'
                sh 'npm -v'
            }
        }
        stage('Install Dependencies') {
            steps {
                sh 'npm ci --legacy-peer-deps'
            }
        }
        stage('Test') {
            steps {
                script {
                    def hasTestTarget = sh(script: "npx ng config projects.mantis-free-version.architect.test > /dev/null 2>&1", returnStatus: true) == 0
                    def specCount = sh(script: "find src -name '*.spec.ts' | wc -l", returnStdout: true).trim()
                    if (hasTestTarget && specCount != '0') {
                        sh 'npx ng test --watch=false'
                    } else {
                        echo "NO TESTS CONFIGURED: no 'test' architect target and/or no *.spec.ts files found (${specCount} found). Skipping test execution — nothing to run. Add a test setup to enable this stage."
                    }
                }
            }
        }
        stage('Angular Build') {
            steps {
                sh 'npx ng build --configuration production'
            }
        }
        stage('SonarQube Analysis & Quality Gate') {
            steps {
                withSonarQubeEnv('SonarQube-Local') {
                    script {
                        def scannerHome = tool 'SonarScannerCLI'
                        sh "${scannerHome}/bin/sonar-scanner -Dsonar.projectKey=omarise-frontend -Dsonar.sources=src -Dsonar.exclusions=**/node_modules/**,**/dist/**,**/.angular/**,**/coverage/** -Dsonar.typescript.tsconfigPaths=tsconfig.sonar.json"
                    }
                }
                timeout(time: 5, unit: 'MINUTES') {
                    waitForQualityGate abortPipeline: true
                }
            }
        }
        stage('Docker Build') {
            steps {
                sh 'docker version'
                sh "docker build -t omarise-frontend:${env.BUILD_NUMBER} ."
                sh "docker images --filter=reference='omarise-frontend'"
            }
        }
        stage('Docker Login') {
            steps {
                withCredentials([usernamePassword(credentialsId: 'omarise-docker-registry', usernameVariable: 'REGISTRY_USER', passwordVariable: 'REGISTRY_TOKEN')]) {
                    sh 'echo "$REGISTRY_TOKEN" | docker login "$REGISTRY" -u "$REGISTRY_USER" --password-stdin'
                }
            }
        }
        stage('Docker Push') {
            steps {
                sh "docker tag omarise-frontend:${env.BUILD_NUMBER} ${env.REGISTRY}/${env.REGISTRY_NAMESPACE}/omarise-frontend:${env.BUILD_NUMBER}"
                sh "docker push ${env.REGISTRY}/${env.REGISTRY_NAMESPACE}/omarise-frontend:${env.BUILD_NUMBER}"
                sh "docker images --filter=reference='${env.REGISTRY}/${env.REGISTRY_NAMESPACE}/omarise-frontend'"
            }
        }

        stage('Cleanup Old GHCR Versions') {
            steps {
                withCredentials([usernamePassword(credentialsId: 'omarise-docker-registry', usernameVariable: 'REGISTRY_USER', passwordVariable: 'REGISTRY_TOKEN')]) {
                    withEnv(['PACKAGE_NAME=omarise-frontend']) {
                        sh 'chmod +x scripts/cleanup-ghcr-package.sh && ./scripts/cleanup-ghcr-package.sh || true'
                    }
                }
            }
        }

        stage('Kubernetes Deploy') {
            steps {
                withCredentials([file(credentialsId: 'kubeconfig-minikube', variable: 'KUBECONFIG')]) {
                    sh 'kubectl version --client'
                    sh "kubectl get namespace ${env.KUBE_NAMESPACE}"
                    sh "kubectl set image deployment/frontend frontend=${env.REGISTRY}/${env.REGISTRY_NAMESPACE}/omarise-frontend:${env.BUILD_NUMBER} -n ${env.KUBE_NAMESPACE}"
                }
            }
        }

        stage('Kubernetes Rollout Verification') {
            steps {
                withCredentials([file(credentialsId: 'kubeconfig-minikube', variable: 'KUBECONFIG')]) {
                    script {
                        try {
                            sh "kubectl rollout status deployment/frontend -n ${env.KUBE_NAMESPACE} --timeout=180s"
                        } catch (err) {
                            echo "Rollout failed for frontend — collecting diagnostics."
                            sh """
                                set +e
                                echo '--- kubectl get pods -n ${env.KUBE_NAMESPACE} ---'
                                kubectl get pods -n ${env.KUBE_NAMESPACE}
                                echo '--- kubectl describe deployment/frontend -n ${env.KUBE_NAMESPACE} ---'
                                kubectl describe deployment/frontend -n ${env.KUBE_NAMESPACE}
                                echo '--- kubectl describe pods -l app=frontend -n ${env.KUBE_NAMESPACE} ---'
                                kubectl describe pods -l app=frontend -n ${env.KUBE_NAMESPACE}
                                echo '--- kubectl logs deployment/frontend -n ${env.KUBE_NAMESPACE} --tail=100 ---'
                                kubectl logs deployment/frontend -n ${env.KUBE_NAMESPACE} --tail=100
                            """
                            error("Kubernetes rollout failed for frontend")
                        }
                    }
                }
            }
        }
    }
    post {
        success {
            echo 'Frontend build succeeded: dist/browser is ready, SonarQube Quality Gate passed, image pushed to registry, Kubernetes deployment rolled out.'
        }
        failure {
            echo 'Frontend pipeline failed — check the stage logs above.'
        }
        always {
            sh 'docker logout "$REGISTRY" || true'
        }
    }
}
