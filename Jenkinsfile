pipeline {
    agent any
    tools {
        nodejs 'Node24'
    }
    stages {
        stage('Checkout') {
            steps {
                git branch: 'dev', credentialsId: 'github-ssh-omarise-frontend', url: 'git@github.com:Sa3id-Boubaker/e-learning-frontend.git'
            }
        }
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
                        // Vitest (via @angular/build:unit-test) runs on jsdom by default when no
                        // --browsers is given — no headless Chrome needed on the Jenkins agent.
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
    }
    post {
        success {
            echo 'Frontend build succeeded: dist/browser is ready, SonarQube Quality Gate passed.'
        }
        failure {
            echo 'Frontend pipeline failed — check the stage logs above.'
        }
    }
}