
Vagrant.configure("2") do |config|
    config.vm.define 'db' do |node|
        node.vm.provider "virtualbox" do |v|
            v.memory = 512
        end
        node.vm.box = "bento/ubuntu-16.04"

        node.vm.network "forwarded_port", guest: 3306, host: 3307, host_ip: "127.0.0.1"
        node.vm.network "forwarded_port", guest: 5432, host: 5433, host_ip: "127.0.0.1"

        node.vm.provision "shell", path: 'test/db_config.sh'
    end
end
